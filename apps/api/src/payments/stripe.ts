import type Stripe from 'stripe';
import type {
  CheckoutRequest,
  CheckoutSession,
  PaymentGateway,
  PaymentStatusResult,
} from './provider';

/** The part of the Stripe SDK we use – lets the tests plug in a fake. */
export type StripeClient = Pick<Stripe, 'checkout' | 'webhooks'>;

export function createStripeGateway(client: StripeClient): PaymentGateway {
  return {
    name: 'stripe',

    async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
      // Stripe wants the smallest currency unit (cents) in `unit_amount`
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = request.items.map(
        (item) => ({
          quantity: item.quantity,
          price_data: {
            currency: 'usd',
            unit_amount: item.priceCents,
            product_data: { name: item.name },
          },
        }),
      );
      if (request.deliveryCents > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: request.deliveryCents,
            product_data: { name: 'Delivery' },
          },
        });
      }

      const session = await client.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        customer_email: request.email,
        client_reference_id: request.orderId,
        metadata: { orderId: request.orderId },
        success_url: request.successUrl,
        cancel_url: request.cancelUrl,
      });
      if (!session.url) throw new Error('Stripe did not return a checkout URL');
      return { sessionId: session.id, redirectUrl: session.url };
    },

    async getStatus(sessionId: string): Promise<PaymentStatusResult> {
      const session = await client.checkout.sessions.retrieve(sessionId);
      const amountCents = session.amount_total ?? undefined;
      if (session.payment_status === 'paid') {
        return { state: 'paid', ...(amountCents === undefined ? {} : { amountCents }) };
      }
      if (session.status === 'expired') return { state: 'failed' };
      return { state: 'unpaid' };
    },
  };
}
