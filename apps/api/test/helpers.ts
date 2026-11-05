import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, inject } from 'vitest';
import type { Role } from '@cart2heavy/shared';
import { createApp, type CreateAppOptions } from '../src/app';
import { loadConfig, type AppConfig } from '../src/config/env';
import { connectDb } from '../src/db';
import type { Weight } from '@cart2heavy/shared';
import { slugify } from '@cart2heavy/shared';
import type { MailMessage, Mailer } from '../src/mail/mailer';
import { Category, Product, User } from '../src/models';

export const PASSWORD = 'password123';

// a real 1x1 PNG
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export interface TestContext {
  config: AppConfig;
  app: ReturnType<typeof createApp>;
}

/**
 * Connects to a fresh database in the shared in-memory MongoDB, builds the app on top of it,
 * and empties all collections before each test.
 */
export function useTestApp(
  overrides: Record<string, string> = {},
  options: CreateAppOptions = {},
): TestContext {
  const ctx = {} as TestContext;
  let uploadDir = '';

  beforeAll(async () => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'c2h-test-'));
    ctx.config = loadConfig({
      NODE_ENV: 'test',
      MONGODB_URI: `${inject('mongoUri')}test_${randomBytes(4).toString('hex')}`,
      JWT_SECRET: 'test-secret-test-secret-test',
      APP_URL: 'http://localhost:8080',
      UPLOAD_DIR: uploadDir,
      PAYMENT_PROVIDER: 'mock',
      ...overrides,
    });
    await connectDb(ctx.config.mongoUri);
    ctx.app = createApp(ctx.config, { rateLimit: false, ...options });
  });

  beforeEach(async () => {
    const collections = await mongoose.connection.db!.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
    // empty (but keep) the upload folders: multer only creates them once, at start-up
    for (const kind of ['products', 'avatars']) {
      const dir = path.join(uploadDir, kind);
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir)) fs.rmSync(path.join(dir, file), { force: true });
    }
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  });

  return ctx;
}

let counter = 0;
export async function createUser(
  role: Role = 'customer',
  overrides: Partial<{ name: string; email: string }> = {},
) {
  counter += 1;
  return User.create({
    name: overrides.name ?? `${role} ${counter}`,
    email: overrides.email ?? `${role}${counter}@example.com`,
    passwordHash: await bcrypt.hash(PASSWORD, 4),
    role,
  });
}

/** The `Set-Cookie` headers of a response (superagent types them loosely). */
export function setCookies(res: { headers: Record<string, unknown> }): string[] {
  const value = res.headers['set-cookie'];
  if (Array.isArray(value)) return value as string[];
  return typeof value === 'string' ? [value] : [];
}

/**
 * A supertest agent that keeps the session cookie, logged in as a brand new user of that role.
 * `cookie` is the same session as a header value, for requests made outside the agent.
 */
export async function loginAs(ctx: TestContext, role: Role = 'customer') {
  const user = await createUser(role);
  const agent = request.agent(ctx.app);
  const res = await agent.post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = setCookies(res)
    .map((c) => c.split(';')[0])
    .join('; ');
  return { agent, user, cookie };
}

export const ADDRESS = {
  fullName: 'Test Customer',
  line1: '1 Test Street',
  city: 'Springfield',
  postalCode: '12345',
  country: 'United States',
  phone: '+1 555 0100',
};

/** An email sender that remembers what it was asked to send. */
export function captureMailer(): Mailer & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send(message) {
      sent.push(message);
      return Promise.resolve();
    },
  };
}

let seq = 0;
export async function makeCategory(name = `Category ${++seq}`, weight: Weight = 'small') {
  return Category.create({ name, slug: slugify(name), weight });
}

export async function makeProduct(
  overrides: Partial<{
    name: string;
    priceCents: number;
    isActive: boolean;
    totalBought: number;
    description: string;
    category: Awaited<ReturnType<typeof makeCategory>>;
  }> = {},
) {
  const category = overrides.category ?? (await makeCategory());
  return Product.create({
    name: overrides.name ?? `Product ${++seq}`,
    description: overrides.description ?? 'A test product',
    priceCents: overrides.priceCents ?? 5000,
    image: 'test.jpg',
    category: category._id,
    isActive: overrides.isActive ?? true,
    totalBought: overrides.totalBought ?? 0,
  });
}

/** Puts products in the logged in agent's cart through the API. */
export async function fillCart(
  agent: ReturnType<typeof request.agent>,
  lines: [{ id: string }, number][],
) {
  for (const [product, quantity] of lines) {
    const res = await agent.put(`/api/cart/items/${product.id}`).send({ quantity });
    if (res.status !== 200)
      throw new Error(`could not fill cart: ${res.status} ${JSON.stringify(res.body)}`);
  }
}

/** Cart -> checkout -> pretend to pay on the mock page -> come back and verify. */
export async function placePaidOrder(
  agent: ReturnType<typeof request.agent>,
  lines: [{ id: string }, number][],
) {
  await fillCart(agent, lines);
  const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
  if (started.status !== 201) throw new Error(`checkout failed: ${JSON.stringify(started.body)}`);
  const orderId = started.body.orderId as string;
  await agent.post(`/api/payments/mock/${orderId}/pay`).expect(200);
  const verified = await agent.post(`/api/orders/${orderId}/verify`).expect(200);
  return { orderId, order: verified.body };
}
