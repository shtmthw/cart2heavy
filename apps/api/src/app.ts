import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import express, { Router, type Express } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import type { AppConfig } from './config/env';
import type { AppContext } from './context';
import { createLogger, type Logger } from './logger';
import { createMailer, type Mailer } from './mail/mailer';
import {
  createPaymentGateway,
  createStripeClient,
  type PaymentGateway,
  type StripeClient,
} from './payments';
import { authenticate } from './middleware/auth';
import { errorHandler, notFound, send } from './middleware/errorHandler';
import { sameOrigin } from './middleware/sameOrigin';
import { adminRoutes } from './modules/admin/routes';
import { authRoutes } from './modules/auth/routes';
import { cartRoutes } from './modules/cart/routes';
import { categoryRoutes } from './modules/categories/routes';
import { logisticsRoutes } from './modules/logistics/routes';
import { orderRoutes } from './modules/orders/routes';
import { mockPaymentRoutes, stripeWebhook } from './modules/payments/routes';
import { productRoutes } from './modules/products/routes';
import { systemRoutes } from './modules/system/routes';
import { userRoutes } from './modules/users/routes';

export interface CreateAppOptions {
  logger?: Logger;
  /** turn the login/register rate limit off (tests) */
  rateLimit?: boolean;
  /** replace the email sender / payment company / Stripe SDK (tests) */
  mailer?: Mailer;
  payments?: PaymentGateway;
  stripe?: StripeClient;
}

export function createApp(config: AppConfig, options: CreateAppOptions = {}): Express {
  const logger = options.logger ?? createLogger(config);
  const stripe = options.stripe ?? createStripeClient(config);
  const ctx: AppContext = {
    config,
    logger,
    stripe,
    mailer: options.mailer ?? createMailer(config, logger),
    payments: options.payments ?? createPaymentGateway(config, stripe),
  };

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : 'info'),
      // keep the log lines short: no headers
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          // Safari upgrades every sub-request to https with this on, which breaks http://localhost
          'upgrade-insecure-requests': null,
          // blob: = the preview of a photo the admin picked, before it is uploaded
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  );

  /* uploaded files (product photos, avatars) */
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      index: false,
      dotfiles: 'ignore',
      maxAge: '30d',
      immutable: true,
    }),
  );

  /* ---------- JSON API ---------- */
  const api = Router();
  // Stripe's webhook needs the raw body to verify the signature, so it comes before the JSON parser
  api.post('/payments/stripe/webhook', ...stripeWebhook(ctx));
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(sameOrigin(config));
  api.use(authenticate(config));

  const authLimiter =
    options.rateLimit === false
      ? (_req: unknown, _res: unknown, next: () => void) => next()
      : rateLimit({
          windowMs: 15 * 60 * 1000,
          limit: 30,
          standardHeaders: 'draft-8',
          legacyHeaders: false,
          handler: (_req, res) =>
            send(res, 429, 'rate_limited', 'Too many attempts. Please try again in a few minutes.'),
        });

  api.use(systemRoutes(ctx));
  api.use('/auth', authRoutes(ctx, authLimiter));
  api.use('/me', userRoutes(ctx));
  api.use('/categories', categoryRoutes());
  api.use('/products', productRoutes());
  api.use('/cart', cartRoutes(ctx));
  api.use('/orders', orderRoutes(ctx));
  api.use('/payments/mock', mockPaymentRoutes(ctx));
  api.use('/admin', adminRoutes(ctx));
  api.use('/logistics', logisticsRoutes(ctx));
  api.use(notFound);
  app.use('/api', api);

  /* ---------- the built web app (production / docker) ---------- */
  if (config.webDist && fs.existsSync(path.join(config.webDist, 'index.html'))) {
    const indexHtml = path.join(config.webDist, 'index.html');
    app.use(express.static(config.webDist, { index: false, maxAge: '1y', immutable: true }));
    // client-side routes (/admin, /orders/123, …) all get the single page app
    app.use((req, res, next) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || !req.accepts('html')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(indexHtml);
    });
  }

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
