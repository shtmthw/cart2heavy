import { Router, type RequestHandler } from 'express';
import { loginSchema, registerSchema, type UserDTO } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { toUserDTO } from '../../dto';
import { clearAuthCookie, setAuthCookie, signToken } from '../../middleware/auth';
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

  /** Who am I? `{ user: null }` (not a 401) for visitors, so a normal page load logs no errors. */
  router.get('/me', async (req, res) => {
    const user = req.user ? await User.findById(req.user.id).lean() : null;
    const body: { user: UserDTO | null } = { user: user ? toUserDTO(user) : null };
    res.json(body);
  });

  return router;
}
