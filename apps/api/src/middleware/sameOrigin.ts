import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env';
import { HttpError } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defence in depth on top of the SameSite=Lax cookie: a state-changing request that names an
 * `Origin` must come from the host the API is being served on (the `Host` header), or from the
 * configured public URL (APP_URL – covers reverse proxies that rewrite `Host`).
 */
export function sameOrigin(config: Pick<AppConfig, 'appUrl'>): RequestHandler {
  const publicOrigin = new URL(config.appUrl).origin;
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next(); // non-browser clients (curl, tests, webhooks) don't send one

    let parsed: URL | null = null;
    try {
      parsed = new URL(origin);
    } catch {
      // "null" or garbage
    }
    if (parsed && (parsed.host === req.get('host') || parsed.origin === publicOrigin)) {
      return next();
    }
    next(HttpError.forbidden('Cross-site request blocked'));
  };
}
