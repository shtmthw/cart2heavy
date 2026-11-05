import { randomBytes } from 'node:crypto';
import type { AppConfig } from '../config/env';
import { MockPayment } from '../models';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentGateway,
  PaymentStatusResult,
} from './provider';

/**
 * A pretend payment company for local use and demos: it sends the customer to our own
 * "test payment" page where they press Pay or Cancel. No money, no account, no network.
 */
export function createMockGateway(config: Pick<AppConfig, 'appUrl'>): PaymentGateway {
  return {
    name: 'mock',

    async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
      const sessionId = `mock_${randomBytes(12).toString('hex')}`;
      await MockPayment.create({
        sessionId,
        order: request.orderId,
        amountCents: request.totalCents,
      });
      return { sessionId, redirectUrl: `${config.appUrl}/checkout/mock/${request.orderId}` };
    },

    async getStatus(sessionId: string): Promise<PaymentStatusResult> {
      const payment = await MockPayment.findOne({ sessionId }).lean();
      if (!payment) return { state: 'failed' };
      return {
        state:
          payment.status === 'paid' ? 'paid' : payment.status === 'cancelled' ? 'failed' : 'unpaid',
        amountCents: payment.amountCents,
      };
    },
  };
}
