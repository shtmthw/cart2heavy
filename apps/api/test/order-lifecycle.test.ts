import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
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

const FAKE_ID = '507f1f77bcf86cd799439011';

describe('who may use /api/logistics', () => {
  const endpoints: [method: 'get' | 'patch', url: string][] = [
    ['get', '/api/logistics/orders'],
    ['patch', `/api/logistics/orders/${FAKE_ID}/status`],
  ];

  it('rejects anonymous visitors, customers and even admins', async () => {
    for (const [method, url] of endpoints) {
      expect((await request(ctx.app)[method](url)).status, `anonymous ${url}`).toBe(401);
    }
    for (const role of ['customer', 'admin'] as const) {
      const { agent } = await loginAs(ctx, role);
      for (const [method, url] of endpoints) {
        expect((await agent[method](url)).status, `${role} ${method} ${url}`).toBe(403);
      }
    }
  });
});

describe('admin: orders list, confirm, cancel', () => {
  it('lists orders newest first with the customer, and filters by status and payment', async () => {
    const admin = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    const paid = await placePaidOrder(shopper.agent, [[product, 1]]);
    await fillCart(shopper.agent, [[product, 1]]);
    const unpaid = await shopper.agent.post('/api/orders/checkout').send({ address: ADDRESS });

    const all = await admin.agent.get('/api/admin/orders');
    expect(all.status).toBe(200);
    expect(all.body).toMatchObject({ total: 2, page: 1, totalPages: 1 });
    expect(all.body.items.map((o: { id: string }) => o.id)).toEqual([
      unpaid.body.orderId,
      paid.orderId,
    ]);
    expect(all.body.items[0].customer).toMatchObject({
      email: shopper.user.email,
      name: shopper.user.name,
    });

    const onlyPaid = await admin.agent.get('/api/admin/orders?payment=paid');
    expect(onlyPaid.body.items.map((o: { id: string }) => o.id)).toEqual([paid.orderId]);
    const none = await admin.agent.get('/api/admin/orders?status=delivered');
    expect(none.body.total).toBe(0);
    await admin.agent.get('/api/admin/orders?status=bogus').expect(400);

    const paged = await admin.agent.get('/api/admin/orders?limit=1&page=2');
    expect(paged.body).toMatchObject({ total: 2, totalPages: 2 });
    expect(paged.body.items).toHaveLength(1);
  });

  it('confirms only paid orders that are still processing', async () => {
    const admin = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    const paid = await placePaidOrder(shopper.agent, [[product, 1]]);
    await fillCart(shopper.agent, [[product, 1]]);
    const unpaid = await shopper.agent.post('/api/orders/checkout').send({ address: ADDRESS });

    const refused = await admin.agent.post(`/api/admin/orders/${unpaid.body.orderId}/confirm`);
    expect(refused.status).toBe(409);
    expect((await Order.findById(unpaid.body.orderId))?.status).toBe('processing');

    mailer.sent.length = 0;
    const ok = await admin.agent.post(`/api/admin/orders/${paid.orderId}/confirm`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('confirmed');
    expect(ok.body.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      'processing',
      'confirmed',
    ]);
    expect(ok.body.statusHistory[1].by).toBe(admin.user.name);
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.subject).toContain('confirmed');

    await admin.agent.post(`/api/admin/orders/${paid.orderId}/confirm`).expect(409); // already confirmed
    await admin.agent.post(`/api/admin/orders/${FAKE_ID}/confirm`).expect(404);
  });

  it('only one of two simultaneous confirmations wins', async () => {
    const adminA = await loginAs(ctx, 'admin');
    const adminB = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx);
    const { orderId } = await placePaidOrder(shopper.agent, [
      [await makeProduct({ priceCents: 10_000 }), 1],
    ]);

    const results = await Promise.all([
      adminA.agent.post(`/api/admin/orders/${orderId}/confirm`),
      adminB.agent.post(`/api/admin/orders/${orderId}/confirm`),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await Order.findById(orderId))?.statusHistory).toHaveLength(2);
  });

  it('cancels until logistics has the package, and takes the sale off the "most bought" counter', async () => {
    const admin = await loginAs(ctx, 'admin');
    const logistics = await loginAs(ctx, 'logistics');
    const shopper = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    const { orderId } = await placePaidOrder(shopper.agent, [[product, 3]]);
    expect((await Product.findById(product.id))?.totalBought).toBe(3);

    const cancelled = await admin.agent.post(`/api/admin/orders/${orderId}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');
    expect((await Product.findById(product.id))?.totalBought).toBe(0);
    expect(mailer.sent.at(-1)?.subject).toContain('cancelled');

    // the customer sees it as cancelled
    expect((await shopper.agent.get(`/api/orders/${orderId}`)).body.status).toBe('cancelled');

    // a cancelled order is not in the warehouse queue and cannot be confirmed again
    expect((await logistics.agent.get('/api/logistics/orders')).body).toEqual([]);
    await admin.agent.post(`/api/admin/orders/${orderId}/confirm`).expect(409);

    // once logistics received a package it can no longer be cancelled
    const second = await placePaidOrder(shopper.agent, [[product, 1]]);
    await admin.agent.post(`/api/admin/orders/${second.orderId}/confirm`).expect(200);
    await logistics.agent
      .patch(`/api/logistics/orders/${second.orderId}/status`)
      .send({ status: 'received' })
      .expect(200);
    await admin.agent.post(`/api/admin/orders/${second.orderId}/cancel`).expect(409);
  });

  it('shows revenue, orders per status and the top products', async () => {
    const admin = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx);
    const category = await makeCategory();
    const popular = await makeProduct({ category, name: 'Popular', priceCents: 10_000 });
    const rare = await makeProduct({ category, name: 'Rare', priceCents: 30_000 });
    await placePaidOrder(shopper.agent, [[popular, 3]]);
    await placePaidOrder(shopper.agent, [[rare, 1]]);
    await fillCart(shopper.agent, [[popular, 1]]);
    await shopper.agent.post('/api/orders/checkout').send({ address: ADDRESS }); // unpaid, not revenue

    const stats = await admin.agent.get('/api/admin/stats');
    expect(stats.status).toBe(200);
    expect(stats.body.revenueCents).toBe(30_180 + 30_180);
    expect(stats.body.ordersTotal).toBe(3);
    expect(stats.body.ordersPaid).toBe(2);
    expect(stats.body.awaitingConfirmation).toBe(2); // paid and still processing
    expect(stats.body.ordersByStatus).toMatchObject({
      processing: 3,
      confirmed: 0,
      delivered: 0,
      cancelled: 0,
    });
    expect(stats.body.topProducts.map((p: { name: string }) => p.name)).toEqual([
      'Popular',
      'Rare',
    ]);
  });
});

describe('logistics: queue and forward-only steps', () => {
  async function confirmedOrder() {
    const admin = await loginAs(ctx, 'admin');
    const shopper = await loginAs(ctx);
    const placed = await placePaidOrder(shopper.agent, [
      [await makeProduct({ priceCents: 10_000 }), 1],
    ]);
    await admin.agent.post(`/api/admin/orders/${placed.orderId}/confirm`).expect(200);
    return { ...placed, admin, shopper };
  }

  it('shows only paid, confirmed orders – with address, items and the package size', async () => {
    const admin = await loginAs(ctx, 'admin');
    const logistics = await loginAs(ctx, 'logistics');
    const shopper = await loginAs(ctx);
    const big = await makeCategory('Desktops', 'large');
    const small = await makeCategory('Phones', 'small');
    const desktop = await makeProduct({ category: big, priceCents: 100_000 });
    const phone = await makeProduct({ category: small, priceCents: 30_000 });

    const processing = await placePaidOrder(shopper.agent, [[phone, 1]]); // not confirmed yet
    const confirmed = await placePaidOrder(shopper.agent, [
      [phone, 1],
      [desktop, 1],
    ]);
    await admin.agent.post(`/api/admin/orders/${confirmed.orderId}/confirm`).expect(200);
    await fillCart(shopper.agent, [[phone, 1]]);
    await shopper.agent.post('/api/orders/checkout').send({ address: ADDRESS }); // unpaid

    const queue = await logistics.agent.get('/api/logistics/orders');
    expect(queue.status).toBe(200);
    expect(queue.body.map((o: { id: string }) => o.id)).toEqual([confirmed.orderId]);
    expect(queue.body.map((o: { id: string }) => o.id)).not.toContain(processing.orderId);
    expect(queue.body[0]).toMatchObject({
      status: 'confirmed',
      packageSize: 'large', // the heaviest item decides
      address: { city: 'Springfield', fullName: 'Test Customer' },
      customer: { email: shopper.user.email },
    });
    expect(queue.body[0].items).toHaveLength(2);
  });

  it('moves an order forward step by step and records who did it', async () => {
    const logistics = await loginAs(ctx, 'logistics');
    const { orderId, shopper } = await confirmedOrder();
    mailer.sent.length = 0;

    for (const status of ['received', 'shipping', 'shipped', 'out_for_delivery', 'delivered']) {
      const res = await logistics.agent
        .patch(`/api/logistics/orders/${orderId}/status`)
        .send({ status });
      expect(res.status, status).toBe(200);
      expect(res.body.status).toBe(status);
    }

    const order = await shopper.agent.get(`/api/orders/${orderId}`);
    expect(order.body.status).toBe('delivered');
    expect(order.body.statusHistory.map((h: { status: string }) => h.status)).toEqual([
      'processing',
      'confirmed',
      'received',
      'shipping',
      'shipped',
      'out_for_delivery',
      'delivered',
    ]);
    // customers see the steps, not the staff names
    expect(order.body.statusHistory.every((h: { by: unknown }) => h.by === null)).toBe(true);

    // emails go out for "shipped" and "delivered"
    expect(mailer.sent.map((m) => m.subject.split(': ')[1])).toEqual(['shipped', 'delivered']);

    // finished orders leave the default queue but can be listed
    expect((await logistics.agent.get('/api/logistics/orders')).body).toEqual([]);
    const done = await logistics.agent.get('/api/logistics/orders?status=delivered');
    expect(done.body).toHaveLength(1);
    expect(done.body[0].statusHistory.at(-1).by).toBe(logistics.user.name);
  });

  it('never moves backwards, sideways or into non-shipping statuses', async () => {
    const logistics = await loginAs(ctx, 'logistics');
    const { orderId } = await confirmedOrder();
    const move = (status: string) =>
      logistics.agent.patch(`/api/logistics/orders/${orderId}/status`).send({ status });

    await move('shipping').expect(200);
    expect((await move('received')).status).toBe(409); // back
    expect((await move('shipping')).status).toBe(409); // same
    expect((await move('confirmed')).status).toBe(409);
    expect((await move('processing')).status).toBe(400); // not a logistics status
    expect((await move('cancelled')).status).toBe(400);
    expect((await move('delivered')).status).toBe(200); // skipping ahead is fine
    expect((await move('shipped')).status).toBe(409);
    expect((await Order.findById(orderId))?.status).toBe('delivered');
  });

  it('cannot touch orders that are unpaid or not yet confirmed', async () => {
    const logistics = await loginAs(ctx, 'logistics');
    const shopper = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    const processing = await placePaidOrder(shopper.agent, [[product, 1]]);
    await fillCart(shopper.agent, [[product, 1]]);
    const unpaid = await shopper.agent.post('/api/orders/checkout').send({ address: ADDRESS });

    const a = await logistics.agent
      .patch(`/api/logistics/orders/${processing.orderId}/status`)
      .send({ status: 'received' });
    expect(a.status).toBe(409);
    const b = await logistics.agent
      .patch(`/api/logistics/orders/${unpaid.body.orderId}/status`)
      .send({ status: 'received' });
    expect(b.status).toBe(404);
    await logistics.agent
      .patch(`/api/logistics/orders/${FAKE_ID}/status`)
      .send({ status: 'received' })
      .expect(404);
  });
});
