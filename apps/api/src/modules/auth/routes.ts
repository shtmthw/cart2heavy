import { Router, type RequestHandler } from 'express';
import { loginSchema, registerSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { toUserDTO } from '../../dto';
import {
  clearAuthCookie,
  currentUser,
  requireAuth,
  setAuthCookie,
  signToken,
} from '../../middleware/auth';
import { HttpError } from '../../errors';
import { User } from '../../models';
import { registerCustomer, verifyLogin } from './service';

export function authRoutes({ config }: AppContext, limiter: RequestHandler): Router {
  const router = Router();

  router.post('/register', limiter, async (req, res) => {
    const input = registerSchema.parse(req.body);
    const user = await registerCustomer(config, input);
    setAuthCookie(config, res, signToken(config, { id: user.id, role: user.role }));
    res.status(201).json(toUserDTO(user));
  });

  router.post('/login', limiter, async (req, res) => {
    const input = loginSchema.parse(req.body);
    const user = await verifyLogin(config, input);
    setAuthCookie(config, res, signToken(config, { id: user.id, role: user.role }));
    res.json(toUserDTO(user));
  });

  router.post('/logout', (_req, res) => {
    clearAuthCookie(config, res);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    const user = await User.findById(currentUser(req).id).lean();
    if (!user) throw HttpError.unauthorized();
    res.json(toUserDTO(user));
  });

  return router;
}
