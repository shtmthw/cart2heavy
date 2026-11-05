import type { RequestHandler } from 'express';
import { HttpError } from '../errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defence in depth on top of the SameSite=Lax cookie: a state-changing request that names an
 * `Origin` must come from the same host the API is being served on.
 */
export const sameOrigin: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients (curl, tests, webhooks) don't send one
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    // "null" or garbage
  }
  if (originHost !== req.get('host')) {
    return next(HttpError.forbidden('Cross-site request blocked'));
  }
  next();
};
