import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Category, Order, Product, User } from '../src/models';
import { createLogger } from '../src/logger';
import { DEMO_PASSWORDS, SEED_ORDERS, SEED_PRODUCTS } from '../src/seed/data';
import { seedDatabase } from '../src/seed/seed';
import { createUser, useTestApp } from './helpers';

const ctx = useTestApp();
const logger = createLogger({ env: 'test', logLevel: 'silent' });

describe('seed', () => {
  it('fills an empty database with working demo data', async () => {
    expect(await seedDatabase({ config: ctx.config, logger })).toBe(true);

    expect(await Category.countDocuments()).toBe(4);
    expect(await Product.countDocuments()).toBe(SEED_PRODUCTS.length);
    expect(await Order.countDocuments()).toBe(SEED_ORDERS.length);
    expect(await User.countDocuments()).toBe(3);

    // photos were copied into the uploads folder and are served
    const product = (await request(ctx.app).get('/api/products?limit=50')).body.items[0];
    await request(ctx.app)
      .get(product.imageUrl as string)
      .expect(200);
    for (const file of new Set(SEED_PRODUCTS.map((p) => p.image))) {
      expect(fs.existsSync(path.join(ctx.config.uploadDir, 'products', file)), file).toBe(true);
    }

    // the three demo accounts can log in with the documented passwords
    for (const [key, role] of [
      ['admin', 'admin'],
      ['logistics', 'logistics'],
      ['demo', 'customer'],
    ] as const) {
      const account = DEMO_PASSWORDS[key];
      const res = await request(ctx.app)
        .post('/api/auth/login')
        .send({ email: account.email, password: account.password });
      expect(res.status, account.email).toBe(200);
      expect(res.body.role).toBe(role);
    }
  });

  it('has orders at several stages and a "most bought" ranking', async () => {
    await seedDatabase({ config: ctx.config, logger });
    const statuses = (await Order.find().lean())
      .map((o) => `${o.status}/${o.payment.status}`)
      .sort();
    expect(statuses).toEqual(
      expect.arrayContaining([
        'delivered/paid',
        'shipped/paid',
        'confirmed/paid',
        'processing/paid',
        'processing/pending',
      ]),
    );
    const top = await request(ctx.app).get('/api/products?sort=popular&limit=3');
    expect(top.body.items[0].totalBought).toBeGreaterThan(0);
    // dates are spread over the past, not all identical
    const dates = new Set((await Order.find().lean()).map((o) => o.createdAt.getTime()));
    expect(dates.size).toBe(SEED_ORDERS.length);
  });

  it('does nothing when there is already data, and --reset starts over', async () => {
    await createUser('customer');
    expect(await seedDatabase({ config: ctx.config, logger })).toBe(false);
    expect(await Product.countDocuments()).toBe(0);

    expect(await seedDatabase({ config: ctx.config, logger }, { reset: true })).toBe(true);
    expect(await Product.countDocuments()).toBe(SEED_PRODUCTS.length);
    expect(await seedDatabase({ config: ctx.config, logger })).toBe(false); // second run: no duplicates
    expect(await Product.countDocuments()).toBe(SEED_PRODUCTS.length);
  });
});
