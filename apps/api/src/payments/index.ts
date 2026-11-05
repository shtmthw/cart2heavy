import Stripe from 'stripe';
import type { AppConfig } from '../config/env';
import { createMockGateway } from './mock';
import type { PaymentGateway } from './provider';
import { createStripeGateway, type StripeClient } from './stripe';

export type { PaymentGateway } from './provider';
export type { StripeClient } from './stripe';

export function createStripeClient(config: AppConfig): StripeClient | undefined {
  return config.payment.stripeSecretKey ? new Stripe(config.payment.stripeSecretKey) : undefined;
}

export function createPaymentGateway(
  config: AppConfig,
  stripe = createStripeClient(config),
): PaymentGateway {
  if (config.payment.provider === 'stripe') {
    if (!stripe) throw new Error('Stripe is selected but STRIPE_SECRET_KEY is missing');
    return createStripeGateway(stripe);
  }
  return createMockGateway(config);
}
