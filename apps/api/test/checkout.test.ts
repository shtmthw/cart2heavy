import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { Order, Product } from '../src/models';
import {
  ADDRESS,
  captureMailer,
  fillCart,
  loginAs,
  makeCategory,
  makeProduct,
  placePaidOrder,
  useTestApp,
} from './helpers';

const mailer = captureMailer();
const ctx = useTestApp({}, { mailer });
beforeEach(() => {
  mailer.sent.length = 0;
});

describe('checkout: money is computed on the server', () => {
  it('needs a login and a non-empty cart', async () => {
    await request(ctx.app).post('/api/orders/checkout').send({ address: ADDRESS }).expect(401);
    const { agent } = await loginAs(ctx);
    const res = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/cart is empty/i);
  });

  it('validates the address', async () => {
    const { agent } = await loginAs(ctx);
    await fillCart(agent, [[await makeProduct({ priceCents: 10_000 }), 1]]);
    const res = await agent
      .post('/api/orders/checkout')
      .send({ address: { ...ADDRESS, city: '' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveProperty('address.city');
    await agent.post('/api/orders/checkout').send({}).expect(400);
  });

  it('prices the order from the database and ignores prices sent by the client', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ name: 'Board', priceCents: 25_000 });
    await fillCart(agent, [[product, 2]]);

    const res = await agent.post('/api/orders/checkout').send({
      address: ADDRESS,
      // all of this is what an attacker would try – none of it is read
      totalCents: 1,
      subtotalCents: 1,
      deliveryCents: 0,
      amount: 1,
      items: [{ product: product.id, priceCents: 1, quantity: 1 }],
      payment: { status: 'paid' },
      status: 'delivered',
    });
    expect(res.status).toBe(201);

    const order = await Order.findById(res.body.orderId).lean();
    expect(order).toMatchObject({
      subtotalCents: 50_000,
      deliveryCents: 180,
      totalCents: 50_180,
      status: 'processing',
      payment: { provider: 'mock', status: 'pending' },
    });
    expect(order?.items[0]).toMatchObject({ name: 'Board', priceCents: 25_000, quantity: 2 });
    expect(res.body.redirectUrl).toBe(`http://localhost:8080/checkout/mock/${res.body.orderId}`);
  });

  it('enforces the $25 minimum on the server', async () => {
    const { agent } = await loginAs(ctx);
    const cheap = await makeProduct({ priceCents: 2_499 });
    await fillCart(agent, [[cheap, 1]]);
    const res = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('min_order');
    expect(res.body.error.message).toContain('$25.00');
    expect(await Order.countDocuments()).toBe(0);

    await fillCart(agent, [[cheap, 1]]); // 24.99 is not enough ...
    const exactly = await makeProduct({ priceCents: 2_500 });
    await fillCart(agent, [[exactly, 1]]);
    await agent.post('/api/orders/checkout').send({ address: ADDRESS }).expect(201); // ... but with 25.00 + 24.99 it is
  });

  it('refuses to check out items that are no longer sold', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ name: 'Retired', priceCents: 30_000 });
    await fillCart(agent, [[product, 1]]);
    product.isActive = false;
    await product.save();

    const res = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toContain('Retired');
    expect(await Order.countDocuments()).toBe(0);
  });

  it('snapshots the product, so later price changes do not rewrite the order', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ name: 'Snapshot', priceCents: 10_000 });
    const { orderId } = await placePaidOrder(agent, [[product, 1]]);

    product.priceCents = 99_999;
    product.name = 'Renamed';
    await product.save();

    const order = await agent.get(`/api/orders/${orderId}`);
    expect(order.body.items[0]).toMatchObject({ name: 'Snapshot', priceCents: 10_000 });
    expect(order.body.totalCents).toBe(10_180);
  });

  it('stamps every order with its own time (the old code gave all orders the boot time)', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 1]]);
    const first = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    await new Promise((r) => setTimeout(r, 25));
    const second = await agent.post('/api/orders/checkout').send({ address: ADDRESS });

    const [a, b] = await Promise.all([
      agent.get(`/api/orders/${first.body.orderId}`),
      agent.get(`/api/orders/${second.body.orderId}`),
    ]);
    expect(new Date(b.body.createdAt).getTime()).toBeGreaterThan(
      new Date(a.body.createdAt).getTime(),
    );
    expect(Date.now() - new Date(b.body.createdAt).getTime()).toBeLessThan(5_000);
  });
});

describe('payment flow (mock provider)', () => {
  it('keeps the cart and the sales counter until the payment is confirmed', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 3]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const orderId = started.body.orderId as string;

    // the customer is on the payment page, nothing is paid yet
    expect((await agent.get('/api/cart')).body.itemCount).toBe(3);
    expect((await Product.findById(product.id))?.totalBought).toBe(0);
    expect(mailer.sent).toHaveLength(0);

    // coming back without paying: still pending, cart is intact
    const notPaid = await agent.post(`/api/orders/${orderId}/verify`).expect(200);
    expect(notPaid.body.payment.status).toBe('pending');
    expect((await agent.get('/api/cart')).body.itemCount).toBe(3);
  });

  it('after payment: order is paid, cart is emptied, "most bought" grows by the QUANTITY, one email', async () => {
    const { agent, user } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    const other = await makeProduct({ priceCents: 20_000 });
    await fillCart(agent, [
      [product, 3],
      [other, 1],
    ]);

    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const orderId = started.body.orderId as string;
    await agent.post(`/api/payments/mock/${orderId}/pay`).expect(200);
    const verified = await agent.post(`/api/orders/${orderId}/verify`);

    expect(verified.status).toBe(200);
    expect(verified.body.payment).toMatchObject({ provider: 'mock', status: 'paid' });
    expect(verified.body.payment.paidAt).toBeTruthy();
    expect(verified.body.status).toBe('processing');
    expect((await agent.get('/api/cart')).body.items).toEqual([]);
    expect((await Product.findById(product.id))?.totalBought).toBe(3);
    expect((await Product.findById(other.id))?.totalBought).toBe(1);

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ to: user.email });
    expect(mailer.sent[0]?.subject).toContain('received');
    expect(mailer.sent[0]?.text).toContain('3 x');
  });

  it('verifying again (refresh, back button, webhook) changes nothing', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    const { orderId } = await placePaidOrder(agent, [[product, 2]]);

    await Promise.all([
      agent.post(`/api/orders/${orderId}/verify`).expect(200),
      agent.post(`/api/orders/${orderId}/verify`).expect(200),
      agent.post(`/api/orders/${orderId}/verify`).expect(200),
    ]);
    expect((await Product.findById(product.id))?.totalBought).toBe(2);
    expect(mailer.sent).toHaveLength(1);
  });

  it('only removes the ordered lines from the cart', async () => {
    const { agent } = await loginAs(ctx);
    const ordered = await makeProduct({ priceCents: 10_000 });
    const later = await makeProduct({ name: 'Added later', priceCents: 5_000 });
    await fillCart(agent, [[ordered, 1]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    await fillCart(agent, [[later, 1]]); // added while on the payment page
    await agent.post(`/api/payments/mock/${started.body.orderId}/pay`).expect(200);
    await agent.post(`/api/orders/${started.body.orderId}/verify`).expect(200);

    const cart = await agent.get('/api/cart');
    expect(cart.body.items.map((l: { product: { name: string } }) => l.product.name)).toEqual([
      'Added later',
    ]);
  });

  it('a cancelled payment leaves the order unpaid and the cart intact, and can be retried', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 1]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const orderId = started.body.orderId as string;

    await agent.post(`/api/payments/mock/${orderId}/cancel`).expect(200);
    const failed = await agent.post(`/api/orders/${orderId}/verify`);
    expect(failed.body.payment.status).toBe('failed');
    expect((await agent.get('/api/cart')).body.itemCount).toBe(1);
    expect((await Product.findById(product.id))?.totalBought).toBe(0);

    const retry = await agent.post(`/api/orders/${orderId}/pay`);
    expect(retry.status).toBe(200);
    expect(retry.body.redirectUrl).toBe(`http://localhost:8080/checkout/mock/${orderId}`);
    expect((await agent.get(`/api/orders/${orderId}`)).body.payment.status).toBe('pending');

    await agent.post(`/api/payments/mock/${orderId}/pay`).expect(200);
    const paid = await agent.post(`/api/orders/${orderId}/verify`);
    expect(paid.body.payment.status).toBe('paid');
    expect((await agent.get('/api/cart')).body.items).toEqual([]);
  });

  it('cannot pay twice or pay for a cancelled order', async () => {
    const { agent } = await loginAs(ctx);
    const admin = await loginAs(ctx, 'admin');
    const product = await makeProduct({ priceCents: 10_000 });
    const { orderId } = await placePaidOrder(agent, [[product, 1]]);
    await agent.post(`/api/orders/${orderId}/pay`).expect(409);

    await fillCart(agent, [[product, 1]]);
    const second = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    await admin.agent.post(`/api/admin/orders/${second.body.orderId}/cancel`).expect(200);
    await agent.post(`/api/orders/${second.body.orderId}/pay`).expect(409);
  });

  it('nobody can mark an order paid without the payment provider saying so', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 1]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const orderId = started.body.orderId as string;

    // the old app trusted "?success=true"
    const res = await agent
      .post(`/api/orders/${orderId}/verify?success=true`)
      .send({ success: true, payment: 'paid' });
    expect(res.body.payment.status).toBe('pending');
    expect((await Order.findById(orderId))?.payment.status).toBe('pending');
  });
});

describe('orders belong to their owner', () => {
  it('another customer gets 404 for reading, verifying, paying and using the mock page', async () => {
    const owner = await loginAs(ctx);
    const stranger = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(owner.agent, [[product, 1]]);
    const started = await owner.agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const orderId = started.body.orderId as string;

    await stranger.agent.get(`/api/orders/${orderId}`).expect(404);
    await stranger.agent.post(`/api/orders/${orderId}/verify`).expect(404);
    await stranger.agent.post(`/api/orders/${orderId}/pay`).expect(404);
    await stranger.agent.get(`/api/payments/mock/${orderId}`).expect(404);
    await stranger.agent.post(`/api/payments/mock/${orderId}/pay`).expect(404);
    expect((await Order.findById(orderId))?.payment.status).toBe('pending');
  });

  it('anonymous visitors get 401', async () => {
    const id = '507f1f77bcf86cd799439011';
    await request(ctx.app).get('/api/orders/mine').expect(401);
    await request(ctx.app).get(`/api/orders/${id}`).expect(401);
    await request(ctx.app).post(`/api/orders/${id}/verify`).expect(401);
    await request(ctx.app).post(`/api/payments/mock/${id}/pay`).expect(401);
  });

  it('GET /orders/mine lists only my orders, newest first', async () => {
    const mine = await loginAs(ctx);
    const theirs = await loginAs(ctx);
    const cat = await makeCategory();
    const a = await makeProduct({ category: cat, name: 'First', priceCents: 10_000 });
    const b = await makeProduct({ category: cat, name: 'Second', priceCents: 10_000 });
    await placePaidOrder(mine.agent, [[a, 1]]);
    await new Promise((r) => setTimeout(r, 15));
    await placePaidOrder(mine.agent, [[b, 1]]);
    await placePaidOrder(theirs.agent, [[a, 1]]);

    const res = await mine.agent.get('/api/orders/mine');
    expect(res.body).toHaveLength(2);
    expect(res.body.map((o: { items: { name: string }[] }) => o.items[0]?.name)).toEqual([
      'Second',
      'First',
    ]);
    expect(res.body[0]).not.toHaveProperty('customer');
  });
});
