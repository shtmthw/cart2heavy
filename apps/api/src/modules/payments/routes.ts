import express, { Router, type RequestHandler } from 'express';
import { objectIdSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { HttpError } from '../../errors';
import { currentUser, requireAuth } from '../../middleware/auth';
import { MockPayment, Order } from '../../models';
import { markOrderPaid } from '../orders/service';

/**
 * The "test payment" page of the mock provider. It stands in for the payment company's own page,
 * so it only exists when PAYMENT_PROVIDER=mock. Only the owner of the order can use it.
 */
export function mockPaymentRoutes({ config }: AppContext): Router {
  const router = Router();
  router.use((_req, _res, next) => {
    if (config.payment.provider !== 'mock') return next(HttpError.notFound('Page'));
    next();
  });
  router.use(requireAuth);

  async function findOpenPayment(userId: string, orderId: string) {
    const order = await Order.findOne({ _id: orderId, user: userId }).lean();
    if (!order?.payment.sessionId) throw HttpError.notFound('Payment');
    const payment = await MockPayment.findOne({ sessionId: order.payment.sessionId });
    if (!payment) throw HttpError.notFound('Payment');
    return payment;
  }

  router.get('/:orderId', async (req, res) => {
    const payment = await findOpenPayment(
      currentUser(req).id,
      objectIdSchema.parse(req.params.orderId),
    );
    res.json({
      orderId: payment.order.toString(),
      amountCents: payment.amountCents,
      status: payment.status,
    });
  });

  router.post('/:orderId/pay', async (req, res) => {
    const payment = await findOpenPayment(
      currentUser(req).id,
      objectIdSchema.parse(req.params.orderId),
    );
    if (payment.status === 'open') {
      payment.status = 'paid';
      await payment.save();
    }
    res.json({ status: payment.status });
  });

  router.post('/:orderId/cancel', async (req, res) => {
    const payment = await findOpenPayment(
      currentUser(req).id,
      objectIdSchema.parse(req.params.orderId),
    );
    if (payment.status === 'open') {
      payment.status = 'cancelled';
      await payment.save();
    }
    res.json({ status: payment.status });
  });

  return router;
}

/**
 * Stripe calls this when a checkout session is paid – even if the customer closed the tab.
 * It needs the raw request body to check the signature, so it is mounted before the JSON parser.
 */
export function stripeWebhook(ctx: AppContext): RequestHandler[] {
  const { config, stripe, logger } = ctx;
  const handler: RequestHandler = async (req, res) => {
    const secret = config.payment.stripeWebhookSecret;
    if (config.payment.provider !== 'stripe' || !stripe || !secret) {
      throw HttpError.notFound('Webhook');
    }
    const signature = req.get('stripe-signature');
    if (!signature || !Buffer.isBuffer(req.body)) throw HttpError.badRequest('Missing signature');

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, secret);
    } catch {
      throw HttpError.badRequest('Invalid signature');
    }

    if (
      event.type === 'checkout.session.completed' ||
      event.type === 'checkout.session.async_payment_succeeded'
    ) {
      const session = event.data.object;
      const orderId = session.client_reference_id ?? session.metadata?.orderId;
      if (
        session.payment_status === 'paid' &&
        orderId &&
        objectIdSchema.safeParse(orderId).success
      ) {
        const order = await Order.findById(orderId).select('totalCents').lean();
        if (order && order.totalCents === session.amount_total) {
          await markOrderPaid(ctx, orderId, session.id);
        } else {
          logger.error(
            { orderId, sessionId: session.id },
            'stripe webhook: amount does not match the order',
          );
        }
      }
    }
    res.json({ received: true });
  };
  return [express.raw({ type: 'application/json', limit: '1mb' }), handler];
}
