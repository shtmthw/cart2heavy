import { Router } from 'express';
import { logisticsOrdersQuerySchema, logisticsStatusSchema, objectIdSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { currentUser, requireRole } from '../../middleware/auth';
import { listQueue, moveOrder } from './service';

/** /api/logistics/* – logistics accounts only. */
export function logisticsRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireRole('logistics'));

  router.get('/orders', async (req, res) => {
    const { status } = logisticsOrdersQuerySchema.parse(req.query);
    res.json(await listQueue(status));
  });

  router.patch('/orders/:id/status', async (req, res) => {
    const { status } = logisticsStatusSchema.parse(req.body);
    const id = objectIdSchema.parse(req.params.id);
    res.json(await moveOrder(ctx, currentUser(req).id, id, status));
  });

  return router;
}
