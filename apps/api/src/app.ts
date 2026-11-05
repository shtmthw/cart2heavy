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
import { authenticate } from './middleware/auth';
import { errorHandler, notFound, send } from './middleware/errorHandler';
import { sameOrigin } from './middleware/sameOrigin';
import { authRoutes } from './modules/auth/routes';
import { systemRoutes } from './modules/system/routes';
import { userRoutes } from './modules/users/routes';

export interface CreateAppOptions {
  logger?: Logger;
  /** turn the login/register rate limit off (tests) */
  rateLimit?: boolean;
}

export function createApp(config: AppConfig, options: CreateAppOptions = {}): Express {
  const logger = options.logger ?? createLogger(config);
  const ctx: AppContext = { config, logger };

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
          'img-src': ["'self'", 'data:'],
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
  api.use(express.json({ limit: '100kb' }));
  api.use(cookieParser());
  api.use(sameOrigin);
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
