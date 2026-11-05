import type Stripe from 'stripe';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { StripeClient } from '../src/payments';
import { Order, Product } from '../src/models';
import { ADDRESS, captureMailer, fillCart, loginAs, makeProduct, useTestApp } from './helpers';

type Created = Stripe.Checkout.SessionCreateParams;

/** A stand-in for the Stripe SDK that remembers what we asked for. */
function fakeStripe() {
  const created: Created[] = [];
  const sessions = new Map<string, Record<string, unknown>>();
  const state = { failCreate: false };
  const client = {
    checkout: {
      sessions: {
        create: (params: Created) => {
          if (state.failCreate) return Promise.reject(new Error('Stripe is down'));
          const id = `cs_test_${created.length + 1}`;
          created.push(params);
          const amount = (params.line_items ?? []).reduce(
            (sum, item) => sum + (item.price_data?.unit_amount ?? 0) * (item.quantity ?? 1),
            0,
          );
          const session = {
            id,
            url: `https://checkout.stripe.test/${id}`,
            payment_status: 'unpaid',
            status: 'open',
            amount_total: amount,
            client_reference_id: params.client_reference_id,
            metadata: params.metadata,
          };
          sessions.set(id, session);
          return Promise.resolve(session);
        },
        retrieve: (id: string) => Promise.resolve(sessions.get(id)),
      },
    },
    webhooks: {
      constructEvent: (payload: Buffer, signature: string) => {
        if (signature !== 'valid-signature')
          throw new Error('No signatures found matching the expected signature');
        return JSON.parse(payload.toString()) as Stripe.Event;
      },
    },
  } as unknown as StripeClient;
  return { client, created, sessions, state };
}

const stripe = fakeStripe();
const mailer = captureMailer();
const ctx = useTestApp(
  {
    PAYMENT_PROVIDER: 'stripe',
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
  },
  { stripe: stripe.client, mailer },
);
beforeEach(() => {
  stripe.state.failCreate = false;
  stripe.created.length = 0;
  stripe.sessions.clear();
  mailer.sent.length = 0;
});

describe('Stripe provider', () => {
  it('sends prices to Stripe in CENTS (a $250.00 item must not become $2.50)', async () => {
    const { agent } = await loginAs(ctx);
    const board = await makeProduct({ name: 'Board', priceCents: 25_000 });
    const cable = await makeProduct({ name: 'Cable', priceCents: 1_999 });
    await fillCart(agent, [
      [board, 1],
      [cable, 2],
    ]);

    const res = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    expect(res.status).toBe(201);
    expect(res.body.redirectUrl).toBe('https://checkout.stripe.test/cs_test_1');

    const params = stripe.created[0]!;
    expect(params.mode).toBe('payment');
    expect(params.line_items).toEqual([
      {
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: 25_000, product_data: { name: 'Board' } },
      },
      {
        quantity: 2,
        price_data: { currency: 'usd', unit_amount: 1_999, product_data: { name: 'Cable' } },
      },
      {
        quantity: 1,
        price_data: { currency: 'usd', unit_amount: 180, product_data: { name: 'Delivery' } },
      },
    ]);
    expect(params.client_reference_id).toBe(res.body.orderId);
    expect(params.success_url).toBe(
      `http://localhost:8080/checkout/result?orderId=${res.body.orderId}`,
    );
    expect(params.cancel_url).toContain('cancelled=1');
  });

  it('verify asks Stripe and only then marks the order paid', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 2]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const orderId = started.body.orderId as string;

    const before = await agent.post(`/api/orders/${orderId}/verify`);
    expect(before.body.payment.status).toBe('pending');

    stripe.sessions.get('cs_test_1')!.payment_status = 'paid';
    const after = await agent.post(`/api/orders/${orderId}/verify`);
    expect(after.body.payment).toMatchObject({ provider: 'stripe', status: 'paid' });
    expect((await Product.findById(product.id))?.totalBought).toBe(2);
    expect(mailer.sent).toHaveLength(1);
  });

  it('does not trust a paid session whose amount differs from the order', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 1]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const session = stripe.sessions.get('cs_test_1')!;
    session.payment_status = 'paid';
    session.amount_total = 250; // $2.50

    const res = await agent.post(`/api/orders/${started.body.orderId}/verify`);
    expect(res.status).toBe(502);
    expect((await Order.findById(started.body.orderId))?.payment.status).toBe('pending');
  });

  it('removes the order again if Stripe cannot start a checkout', async () => {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 1]]);
    stripe.state.failCreate = true;
    const res = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('payment_error');
    expect(await Order.countDocuments()).toBe(0);
    expect((await agent.get('/api/cart')).body.itemCount).toBe(1);
  });

  it('has no mock payment page when Stripe is the provider', async () => {
    const { agent } = await loginAs(ctx);
    await agent.post('/api/payments/mock/507f1f77bcf86cd799439011/pay').expect(404);
  });
});

describe('Stripe webhook', () => {
  async function startedOrder() {
    const { agent } = await loginAs(ctx);
    const product = await makeProduct({ priceCents: 10_000 });
    await fillCart(agent, [[product, 2]]);
    const started = await agent.post('/api/orders/checkout').send({ address: ADDRESS });
    const order = (await Order.findById(started.body.orderId))!;
    return { agent, product, order };
  }

  const completedEvent = (orderId: string, amount: number) => ({
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_status: 'paid',
        amount_total: amount,
        client_reference_id: orderId,
        metadata: { orderId },
      },
    },
  });

  it('rejects calls without a valid signature', async () => {
    const { order } = await startedOrder();
    const body = JSON.stringify(completedEvent(order.id, order.totalCents));
    await request(ctx.app)
      .post('/api/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .send(body)
      .expect(400);
    await request(ctx.app)
      .post('/api/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'forged')
      .send(body)
      .expect(400);
    expect((await Order.findById(order.id))?.payment.status).toBe('pending');
  });

  it('records the payment even though the customer never came back – exactly once', async () => {
    const { order, product, agent } = await startedOrder();
    const send = () =>
      request(ctx.app)
        .post('/api/payments/stripe/webhook')
        .set('Content-Type', 'application/json')
        .set('Stripe-Signature', 'valid-signature')
        .send(JSON.stringify(completedEvent(order.id, order.totalCents)));

    expect((await send()).status).toBe(200);
    expect((await send()).status).toBe(200); // Stripe retries – must not double count

    expect((await Order.findById(order.id))?.payment.status).toBe('paid');
    expect((await Product.findById(product.id))?.totalBought).toBe(2);
    expect(mailer.sent).toHaveLength(1);
    expect((await agent.get('/api/cart')).body.items).toEqual([]);
  });

  it('ignores a paid event whose amount does not match the order', async () => {
    const { order } = await startedOrder();
    await request(ctx.app)
      .post('/api/payments/stripe/webhook')
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', 'valid-signature')
      .send(JSON.stringify(completedEvent(order.id, 100)))
      .expect(200);
    expect((await Order.findById(order.id))?.payment.status).toBe('pending');
  });
});
