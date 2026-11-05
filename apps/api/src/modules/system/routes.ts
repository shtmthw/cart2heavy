import { Router } from 'express';
import { CURRENCY, type AppConfigDTO } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { isDbConnected } from '../../db';

export function systemRoutes({ config }: AppContext): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    const db = isDbConnected();
    res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', db });
  });

  /** Shop rules the web app needs to show a cart before the user has logged in. */
  router.get('/config', (_req, res) => {
    const body: AppConfigDTO = {
      currency: CURRENCY,
      minOrderCents: config.minOrderCents,
      deliveryCents: config.deliveryCents,
      paymentProvider: config.payment.provider,
    };
    res.json(body);
  });

  return router;
}
