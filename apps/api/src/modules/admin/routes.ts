import { Router } from 'express';
import { adminOrdersQuerySchema, objectIdSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { currentUser, requireRole } from '../../middleware/auth';
import { adminCategoryRoutes } from '../categories/routes';
import { adminProductRoutes } from '../products/routes';
import { cancelOrder, confirmOrder, getStats, listOrders } from './service';

/** /api/admin/* – admin accounts only. */
export function adminRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireRole('admin'));

  router.use('/categories', adminCategoryRoutes());
  router.use('/products', adminProductRoutes(ctx));

  router.get('/orders', async (req, res) => {
    res.json(await listOrders(adminOrdersQuerySchema.parse(req.query)));
  });
  router.post('/orders/:id/confirm', async (req, res) => {
    res.json(await confirmOrder(ctx, currentUser(req).id, objectIdSchema.parse(req.params.id)));
  });
  router.post('/orders/:id/cancel', async (req, res) => {
    res.json(await cancelOrder(ctx, currentUser(req).id, objectIdSchema.parse(req.params.id)));
  });

  router.get('/stats', async (_req, res) => {
    res.json(await getStats());
  });

  return router;
}
