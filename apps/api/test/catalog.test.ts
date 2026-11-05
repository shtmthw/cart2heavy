import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeCategory, makeProduct, useTestApp } from './helpers';

const ctx = useTestApp();

describe('GET /api/products', () => {
  it('paginates and reports totals', async () => {
    const category = await makeCategory('Boards', 'medium');
    for (let i = 1; i <= 5; i += 1) await makeProduct({ category, name: `Board ${i}` });

    const page1 = await request(ctx.app).get('/api/products?limit=2&page=1');
    expect(page1.status).toBe(200);
    expect(page1.body).toMatchObject({ page: 1, limit: 2, total: 5, totalPages: 3 });
    expect(page1.body.items).toHaveLength(2);

    const page3 = await request(ctx.app).get('/api/products?limit=2&page=3');
    expect(page3.body.items).toHaveLength(1);
    // every product only once across pages
    const page2 = await request(ctx.app).get('/api/products?limit=2&page=2');
    const ids = [...page1.body.items, ...page2.body.items, ...page3.body.items].map(
      (p: { id: string }) => p.id,
    );
    expect(new Set(ids).size).toBe(5);
  });

  it('counts pages for the filtered category only', async () => {
    const phones = await makeCategory('Phones', 'small');
    const laptops = await makeCategory('Laptops', 'big');
    for (let i = 0; i < 7; i += 1) await makeProduct({ category: laptops });
    await makeProduct({ category: phones, name: 'The only phone' });

    const res = await request(ctx.app).get('/api/products?category=phones&limit=2');
    expect(res.body.total).toBe(1);
    expect(res.body.totalPages).toBe(1); // was "all products / page size" in the old app
    expect(res.body.items[0]).toMatchObject({
      name: 'The only phone',
      category: { slug: 'phones', weight: 'small' },
    });
  });

  it('returns an empty page for an unknown category instead of failing', async () => {
    await makeProduct();
    const res = await request(ctx.app).get('/api/products?category=nope');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 0, totalPages: 0, items: [] });
  });

  it('hides inactive products', async () => {
    await makeProduct({ name: 'Visible' });
    await makeProduct({ name: 'Hidden', isActive: false });
    const res = await request(ctx.app).get('/api/products');
    expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['Visible']);
  });

  it('sorts by popularity, price and newest', async () => {
    const category = await makeCategory();
    await makeProduct({ category, name: 'Cheap', priceCents: 3000, totalBought: 1 });
    await makeProduct({ category, name: 'Pricey', priceCents: 90_000, totalBought: 9 });
    await makeProduct({ category, name: 'Middle', priceCents: 40_000, totalBought: 5 });
    const names = async (sort: string) =>
      (await request(ctx.app).get(`/api/products?sort=${sort}`)).body.items.map(
        (p: { name: string }) => p.name,
      );

    expect(await names('popular')).toEqual(['Pricey', 'Middle', 'Cheap']);
    expect(await names('price_asc')).toEqual(['Cheap', 'Middle', 'Pricey']);
    expect(await names('price_desc')).toEqual(['Pricey', 'Middle', 'Cheap']);
    expect(await names('newest')).toEqual(['Middle', 'Pricey', 'Cheap']);
  });

  it('returns the top 3 most bought with sort=popular&limit=3', async () => {
    const category = await makeCategory();
    for (const [name, bought] of [
      ['A', 1],
      ['B', 8],
      ['C', 3],
      ['D', 5],
    ] as const) {
      await makeProduct({ category, name, totalBought: bought });
    }
    const res = await request(ctx.app).get('/api/products?sort=popular&limit=3');
    expect(res.body.items.map((p: { name: string }) => p.name)).toEqual(['B', 'D', 'C']);
  });

  it('searches names and descriptions, and treats special characters literally', async () => {
    await makeProduct({ name: 'MSI MPG board', description: 'gaming' });
    await makeProduct({ name: 'Phone (128GB)', description: 'has a camera' });
    const search = async (q: string) =>
      (await request(ctx.app).get('/api/products').query({ q })).body.items.map(
        (p: { name: string }) => p.name,
      );

    expect(await search('mpg')).toEqual(['MSI MPG board']);
    expect(await search('camera')).toEqual(['Phone (128GB)']);
    expect(await search('(128')).toEqual(['Phone (128GB)']);
    expect(await search('.*')).toEqual([]); // not a regex wildcard
  });

  it('loads specific products by id (a guest cart)', async () => {
    const a = await makeProduct();
    await makeProduct();
    const c = await makeProduct();
    const res = await request(ctx.app).get(`/api/products?ids=${a.id},${c.id}`);
    expect(res.body.items.map((p: { id: string }) => p.id).sort()).toEqual([a.id, c.id].sort());
  });

  it('rejects an absurd page size', async () => {
    await request(ctx.app).get('/api/products?limit=1000').expect(400);
  });
});

describe('GET /api/products/suggest and /:id', () => {
  it('suggests products whose name matches, best matches first', async () => {
    await makeProduct({ name: 'Best MSI board' });
    await makeProduct({ name: 'MSI Ryzen board' });
    await makeProduct({ name: 'Phone' });
    const res = await request(ctx.app).get('/api/products/suggest?q=msi');
    expect(res.status).toBe(200);
    expect(res.body.map((p: { name: string }) => p.name)).toEqual([
      'MSI Ryzen board',
      'Best MSI board',
    ]);
    expect(res.body[0]).toHaveProperty('imageUrl');
    await request(ctx.app).get('/api/products/suggest').expect(400);
  });

  it('shows one product by id (so a page refresh works) and 404s for unknown or hidden ones', async () => {
    const product = await makeProduct({ name: 'Detail', priceCents: 12_345 });
    const hidden = await makeProduct({ isActive: false });

    const res = await request(ctx.app).get(`/api/products/${product.id}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: product.id, name: 'Detail', priceCents: 12_345 });
    expect(res.body.imageUrl).toBe('/uploads/products/test.jpg');

    await request(ctx.app).get(`/api/products/${hidden.id}`).expect(404);
    await request(ctx.app).get('/api/products/507f1f77bcf86cd799439011').expect(404);
    await request(ctx.app).get('/api/products/not-an-id').expect(400);
  });
});

describe('GET /api/categories', () => {
  it('lists categories with the number of visible products', async () => {
    const phones = await makeCategory('Phones', 'small');
    await makeCategory('Empty', 'large');
    await makeProduct({ category: phones });
    await makeProduct({ category: phones });
    await makeProduct({ category: phones, isActive: false });

    const res = await request(ctx.app).get('/api/categories');
    expect(res.body).toEqual([
      expect.objectContaining({ name: 'Empty', slug: 'empty', weight: 'large', productCount: 0 }),
      expect.objectContaining({ name: 'Phones', slug: 'phones', weight: 'small', productCount: 2 }),
    ]);
  });
});
