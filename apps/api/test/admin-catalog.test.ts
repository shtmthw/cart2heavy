import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { Product } from '../src/models';
import {
  fillCart,
  loginAs,
  makeCategory,
  makeProduct,
  PNG_BYTES,
  placePaidOrder,
  useTestApp,
} from './helpers';

const ctx = useTestApp();

const productFiles = () => {
  const dir = path.join(ctx.config.uploadDir, 'products');
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f !== 'test.jpg') : [];
};

describe('who may use /api/admin', () => {
  const endpoints: [method: 'get' | 'post' | 'patch' | 'delete', url: string][] = [
    ['get', '/api/admin/products'],
    ['post', '/api/admin/products'],
    ['patch', '/api/admin/products/507f1f77bcf86cd799439011'],
    ['delete', '/api/admin/products/507f1f77bcf86cd799439011'],
    ['get', '/api/admin/categories'],
    ['post', '/api/admin/categories'],
    ['patch', '/api/admin/categories/507f1f77bcf86cd799439011'],
    ['delete', '/api/admin/categories/507f1f77bcf86cd799439011'],
    ['get', '/api/admin/orders'],
    ['post', '/api/admin/orders/507f1f77bcf86cd799439011/confirm'],
    ['post', '/api/admin/orders/507f1f77bcf86cd799439011/cancel'],
    ['get', '/api/admin/stats'],
  ];

  it('rejects anonymous visitors with 401', async () => {
    for (const [method, url] of endpoints) {
      const res = await request(ctx.app)[method](url);
      expect(res.status, `${method} ${url}`).toBe(401);
    }
  });

  it('rejects customers and logistics staff with 403', async () => {
    for (const role of ['customer', 'logistics'] as const) {
      const { agent } = await loginAs(ctx, role);
      for (const [method, url] of endpoints) {
        const res = await agent[method](url);
        expect(res.status, `${role} ${method} ${url}`).toBe(403);
      }
    }
  });
});

describe('admin categories', () => {
  it('creates, renames and deletes a category', async () => {
    const { agent } = await loginAs(ctx, 'admin');

    const created = await agent
      .post('/api/admin/categories')
      .send({ name: 'Gaming Laptops', weight: 'big' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Gaming Laptops',
      slug: 'gaming-laptops',
      weight: 'big',
      productCount: 0,
    });

    const renamed = await agent
      .patch(`/api/admin/categories/${created.body.id}`)
      .send({ name: 'Laptops', weight: 'large' });
    expect(renamed.body).toMatchObject({ name: 'Laptops', slug: 'laptops', weight: 'large' });

    await agent.delete(`/api/admin/categories/${created.body.id}`).expect(204);
    expect((await agent.get('/api/admin/categories')).body).toEqual([]);
  });

  it('refuses duplicates (any letter case) and invalid weights', async () => {
    const { agent } = await loginAs(ctx, 'admin');
    await agent.post('/api/admin/categories').send({ name: 'Phones', weight: 'small' }).expect(201);
    const dup = await agent.post('/api/admin/categories').send({ name: 'phones', weight: 'small' });
    expect(dup.status).toBe(409);
    await agent
      .post('/api/admin/categories')
      .send({ name: 'Tablets', weight: 'gigantic' })
      .expect(400);
  });

  it('will not delete a category that still has products', async () => {
    const { agent } = await loginAs(ctx, 'admin');
    const category = await makeCategory('In use');
    await makeProduct({ category, isActive: false }); // even hidden products count
    const res = await agent.delete(`/api/admin/categories/${category.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/1 product is still/);
  });

  it('the admin list counts hidden products as well', async () => {
    const { agent } = await loginAs(ctx, 'admin');
    const category = await makeCategory('Mixed');
    await makeProduct({ category });
    await makeProduct({ category, isActive: false });
    const res = await agent.get('/api/admin/categories');
    expect(res.body[0].productCount).toBe(2);
  });
});

describe('admin products', () => {
  it('creates a product with a photo', async () => {
    const { agent } = await loginAs(ctx, 'admin');
    const category = await makeCategory('Boards', 'medium');

    const res = await agent
      .post('/api/admin/products')
      .field('name', 'New board')
      .field('description', 'Brand new')
      .field('priceCents', '25000')
      .field('category', category.id)
      .attach('image', PNG_BYTES, 'board.png');

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      name: 'New board',
      priceCents: 25_000,
      isActive: true,
      totalBought: 0,
    });
    expect(res.body.category).toMatchObject({ name: 'Boards', weight: 'medium' });
    expect(res.body.imageUrl).toMatch(/^\/uploads\/products\/[0-9a-f-]{36}\.png$/);
    expect(productFiles()).toHaveLength(1);
    await request(ctx.app)
      .get(res.body.imageUrl as string)
      .expect(200);

    // and shoppers can see it
    expect((await request(ctx.app).get('/api/products')).body.total).toBe(1);
  });

  it('requires a photo, a valid price and an existing category – and keeps no file when it fails', async () => {
    const { agent } = await loginAs(ctx, 'admin');
    const category = await makeCategory();
    const fields = (req: request.Test) =>
      req
        .field('name', 'Thing')
        .field('description', 'A thing')
        .field('priceCents', '1000')
        .field('category', category.id);

    const noPhoto = await fields(agent.post('/api/admin/products'));
    expect(noPhoto.status).toBe(400);

    const badPrice = await agent
      .post('/api/admin/products')
      .field('name', 'Thing')
      .field('description', 'A thing')
      .field('priceCents', '-5')
      .field('category', category.id)
      .attach('image', PNG_BYTES, 'x.png');
    expect(badPrice.status).toBe(400);

    const badCategory = await agent
      .post('/api/admin/products')
      .field('name', 'Thing')
      .field('description', 'A thing')
      .field('priceCents', '1000')
      .field('category', '507f1f77bcf86cd799439011')
      .attach('image', PNG_BYTES, 'x.png');
    expect(badCategory.status).toBe(400);

    expect(productFiles()).toHaveLength(0);
    expect(await Product.countDocuments()).toBe(0);
  });

  it('edits a product, replacing the photo and removing the old file', async () => {
    const { agent } = await loginAs(ctx, 'admin');
    const category = await makeCategory();
    const created = await agent
      .post('/api/admin/products')
      .field('name', 'Before')
      .field('description', 'Old text')
      .field('priceCents', '1000')
      .field('category', category.id)
      .attach('image', PNG_BYTES, 'a.png');
    expect(productFiles()).toHaveLength(1);

    const edited = await agent
      .patch(`/api/admin/products/${created.body.id}`)
      .field('name', 'After')
      .field('priceCents', '2000')
      .field('isActive', 'false')
      .attach('image', PNG_BYTES, 'b.png');
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({
      name: 'After',
      priceCents: 2000,
      description: 'Old text',
      isActive: false,
    });
    expect(edited.body.imageUrl).not.toBe(created.body.imageUrl);
    expect(productFiles()).toHaveLength(1);

    // text-only edit keeps the photo
    const again = await agent
      .patch(`/api/admin/products/${created.body.id}`)
      .send({ description: 'New text' });
    expect(again.body.imageUrl).toBe(edited.body.imageUrl);
  });

  it('deletes a never-ordered product for good, together with its photo and cart lines', async () => {
    const admin = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx, 'customer');
    const category = await makeCategory();
    const created = await admin.agent
      .post('/api/admin/products')
      .field('name', 'Short lived')
      .field('description', 'Gone soon')
      .field('priceCents', '9000')
      .field('category', category.id)
      .attach('image', PNG_BYTES, 'a.png');
    await fillCart(shopper.agent, [[{ id: created.body.id }, 2]]);

    const res = await admin.agent.delete(`/api/admin/products/${created.body.id}`);
    expect(res.body).toEqual({ result: 'deleted' });
    expect(productFiles()).toHaveLength(0);
    expect(await Product.countDocuments()).toBe(0);
    expect((await shopper.agent.get('/api/cart')).body.items).toEqual([]);
  });

  it('only hides a product that was ordered before, so old orders stay intact', async () => {
    const admin = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx, 'customer');
    const product = await makeProduct({ name: 'Sold once', priceCents: 30_000 });
    const { orderId } = await placePaidOrder(shopper.agent, [[product, 1]]);

    const res = await admin.agent.delete(`/api/admin/products/${product.id}`);
    expect(res.body).toEqual({ result: 'hidden' });

    expect((await request(ctx.app).get('/api/products')).body.total).toBe(0);
    await request(ctx.app).get(`/api/products/${product.id}`).expect(404);
    const order = await shopper.agent.get(`/api/orders/${orderId}`);
    expect(order.body.items[0]).toMatchObject({ name: 'Sold once', priceCents: 30_000 });
    // the admin still sees it, marked as hidden
    expect((await admin.agent.get('/api/admin/products')).body.items[0]).toMatchObject({
      isActive: false,
    });
  });
});
