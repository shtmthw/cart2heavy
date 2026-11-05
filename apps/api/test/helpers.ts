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
import { User } from '../src/models';

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
