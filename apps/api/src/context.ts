import type { AppConfig } from './config/env';
import type { Logger } from './logger';
import type { Mailer } from './mail/mailer';
import type { PaymentGateway, StripeClient } from './payments';

/** Everything a module needs from the outside world. Built once in createApp. */
export interface AppContext {
  config: AppConfig;
  logger: Logger;
  mailer: Mailer;
  payments: PaymentGateway;
  /** only present when Stripe is configured (used by the webhook) */
  stripe: StripeClient | undefined;
}
