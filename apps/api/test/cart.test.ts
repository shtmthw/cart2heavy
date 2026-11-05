import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { User } from '../src/models';
import { fillCart, loginAs, makeProduct, useTestApp } from './helpers';

const ctx = useTestApp();

describe('cart', () => {
  it('needs a login', async () => {
    await request(ctx.app).get('/api/cart').expect(401);
    await request(ctx.app)
      .put('/api/cart/items/507f1f77bcf86cd799439011')
      .send({ quantity: 1 })
      .expect(401);
    await request(ctx.app).post('/api/cart/merge').send({ items: [] }).expect(401);
  });

  it('starts empty', async () => {
    const { agent } = await loginAs(ctx);
    const res = await agent.get('/api/cart');
    expect(res.body).toEqual({
      items: [],
      itemCount: 0,
      subtotalCents: 0,
      deliveryCents: 0,
      totalCents: 0,
      minOrderCents: 2500,
      meetsMinimum: false,
    });
  });

  it('adds, changes and removes lines and computes the totals on the server', async () => {
    const { agent } = await loginAs(ctx);
    const board = await makeProduct({ name: 'Board', priceCents: 25_000 });
    const cable = await makeProduct({ name: 'Cable', priceCents: 999 });

    await agent.put(`/api/cart/items/${board.id}`).send({ quantity: 1 }).expect(200);
    const two = await agent.put(`/api/cart/items/${cable.id}`).send({ quantity: 3 });
    expect(two.body).toMatchObject({
      itemCount: 4,
      subtotalCents: 25_000 + 3 * 999,
      deliveryCents: 180,
      totalCents: 25_000 + 3 * 999 + 180,
      meetsMinimum: true,
    });
    expect(two.body.items).toHaveLength(2);
    expect(two.body.items[1]).toMatchObject({
      quantity: 3,
      lineTotalCents: 2997,
      product: { name: 'Cable' },
    });

    // setting the quantity again replaces it – it does not add up
    const changed = await agent.put(`/api/cart/items/${cable.id}`).send({ quantity: 1 });
    expect(changed.body.items[1].quantity).toBe(1);
    expect(changed.body.items).toHaveLength(2);

    const removed = await agent.delete(`/api/cart/items/${board.id}`);
    expect(removed.body.items).toHaveLength(1);
    expect(removed.body.meetsMinimum).toBe(false);
  });

  it('validates quantities and products', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct();
    const hidden = await makeProduct({ isActive: false });
    await agent.put(`/api/cart/items/${product.id}`).send({ quantity: 0 }).expect(400);
    await agent.put(`/api/cart/items/${product.id}`).send({ quantity: 100 }).expect(400);
    await agent.put(`/api/cart/items/${product.id}`).send({ quantity: 1.5 }).expect(400);
    await agent.put(`/api/cart/items/${product.id}`).send({}).expect(400);
    await agent.put(`/api/cart/items/${hidden.id}`).send({ quantity: 1 }).expect(404);
    await agent.put('/api/cart/items/507f1f77bcf86cd799439011').send({ quantity: 1 }).expect(404);
    await agent.put('/api/cart/items/nope').send({ quantity: 1 }).expect(400);
  });

  it('keeps every user’s cart separate', async () => {
    const a = await loginAs(ctx);
    const b = await loginAs(ctx);
    const product = await makeProduct();
    await fillCart(a.agent, [[product, 2]]);
    expect((await b.agent.get('/api/cart')).body.items).toEqual([]);
    expect((await a.agent.get('/api/cart')).body.itemCount).toBe(2);
  });

  it('drops products that were deleted and shows hidden ones as unavailable (not charged)', async () => {
    const { agent, user } = await loginAs(ctx);
    const keep = await makeProduct({ name: 'Keep', priceCents: 10_000 });
    const hide = await makeProduct({ name: 'Hide', priceCents: 40_000 });
    const gone = await makeProduct({ name: 'Gone' });
    await fillCart(agent, [
      [keep, 1],
      [hide, 1],
      [gone, 1],
    ]);

    hide.isActive = false;
    await hide.save();
    await gone.deleteOne();

    const res = await agent.get('/api/cart');
    expect(res.body.items.map((l: { product: { name: string } }) => l.product.name)).toEqual([
      'Keep',
      'Hide',
    ]);
    expect(res.body.items[1]).toMatchObject({ lineTotalCents: 0, product: { isActive: false } });
    expect(res.body.subtotalCents).toBe(10_000);
    // the dangling line was cleaned up in the database
    expect((await User.findById(user.id))?.cart).toHaveLength(2);
  });

  it('merges a guest cart after login: adds up quantities, skips unknown products, caps at 99', async () => {
    const { agent } = await loginAs(ctx);
    const a = await makeProduct({ name: 'A' });
    const b = await makeProduct({ name: 'B' });
    const hidden = await makeProduct({ isActive: false });
    await fillCart(agent, [[a, 2]]);

    const res = await agent.post('/api/cart/merge').send({
      items: [
        { productId: a.id, quantity: 3 },
        { productId: a.id, quantity: 1 }, // the same product twice in the guest cart
        { productId: b.id, quantity: 99 },
        { productId: hidden.id, quantity: 1 },
        { productId: '507f1f77bcf86cd799439011', quantity: 1 },
      ],
    });
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      res.body.items.map((l: { product: { name: string }; quantity: number }) => [
        l.product.name,
        l.quantity,
      ]),
    );
    expect(byName).toEqual({ A: 6, B: 99 });

    const capped = await agent
      .post('/api/cart/merge')
      .send({ items: [{ productId: b.id, quantity: 5 }] });
    expect(
      capped.body.items.find((l: { product: { name: string } }) => l.product.name === 'B').quantity,
    ).toBe(99);
  });

  it('rejects a malformed merge', async () => {
    const { agent } = await loginAs(ctx);
    await agent
      .post('/api/cart/merge')
      .send({ items: [{ productId: 'x', quantity: 1 }] })
      .expect(400);
    await agent.post('/api/cart/merge').send({}).expect(400);
  });
});
