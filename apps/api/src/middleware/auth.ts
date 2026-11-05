import type { RequestHandler, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { isValidObjectId } from 'mongoose';
import type { Role } from '@cart2heavy/shared';
import type { AppConfig } from '../config/env';
import { HttpError } from '../errors';
import { User } from '../models';

export const AUTH_COOKIE = 'c2h_token';
const TOKEN_TTL_DAYS = 7;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** set by `authenticate` when the request carries a valid session cookie */
      user?: AuthUser;
    }
  }
}

export function signToken(config: AppConfig, user: { id: string; role: Role }): string {
  return jwt.sign({ role: user.role }, config.jwtSecret, {
    subject: user.id,
    algorithm: 'HS256',
    expiresIn: `${TOKEN_TTL_DAYS}d`,
  });
}

export function setAuthCookie(config: AppConfig, res: Response, token: string): void {
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    maxAge: TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(config: AppConfig, res: Response): void {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.secureCookies,
    path: '/',
  });
}

/**
 * Reads the session cookie and, when it is valid, loads the user from the database
 * (so a deleted user or a changed role takes effect immediately). Never rejects by itself.
 */
export function authenticate(config: AppConfig): RequestHandler {
  return async (req, _res, next) => {
    const token = (req.cookies as Record<string, string | undefined> | undefined)?.[AUTH_COOKIE];
    if (!token) return next();
    try {
      const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      if (
        typeof payload === 'object' &&
        typeof payload.sub === 'string' &&
        isValidObjectId(payload.sub)
      ) {
        const user = await User.findById(payload.sub).select('name email role').lean();
        if (user) {
          req.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: user.role,
          };
        }
      }
    } catch {
      // expired or tampered token: treat the request as anonymous
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(HttpError.unauthorized());
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(HttpError.unauthorized());
    if (!roles.includes(req.user.role)) return next(HttpError.forbidden());
    next();
  };
}

/** The logged-in user. Use inside handlers that sit behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
}
