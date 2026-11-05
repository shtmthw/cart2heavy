import type { PaymentProvider } from '@cart2heavy/shared';

export interface CheckoutRequest {
  orderId: string;
  email: string;
  items: { name: string; priceCents: number; quantity: number }[];
  deliveryCents: number;
  totalCents: number;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  sessionId: string;
  /** where the browser goes to pay */
  redirectUrl: string;
}

export interface PaymentStatusResult {
  state: 'paid' | 'unpaid' | 'failed';
  /** what the provider says was charged, in cents (checked against the order total) */
  amountCents?: number;
}

/** A payment company. The shop only ever asks it two things: "start a checkout" and "was it paid?". */
export interface PaymentGateway {
  readonly name: PaymentProvider;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  getStatus(sessionId: string): Promise<PaymentStatusResult>;
}
