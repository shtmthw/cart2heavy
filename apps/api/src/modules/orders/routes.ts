import { Router } from 'express';
import { checkoutSchema, objectIdSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { currentUser, requireAuth } from '../../middleware/auth';
import { checkout, getMyOrder, listMyOrders, retryPayment, verifyOrder } from './service';

/** /api/orders – a customer's own orders and the checkout flow. */
export function orderRoutes(ctx: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.post('/checkout', async (req, res) => {
    const { address } = checkoutSchema.parse(req.body);
    res.status(201).json(await checkout(ctx, currentUser(req), { address }));
  });

  // must be declared before "/:id"
  router.get('/mine', async (req, res) => {
    res.json(await listMyOrders(currentUser(req).id));
  });

  router.get('/:id', async (req, res) => {
    res.json(await getMyOrder(currentUser(req).id, objectIdSchema.parse(req.params.id)));
  });

  /** The customer is back from the payment page: ask the provider and update the order. */
  router.post('/:id/verify', async (req, res) => {
    res.json(await verifyOrder(ctx, currentUser(req).id, objectIdSchema.parse(req.params.id)));
  });

  /** Pay again for an order that is still unpaid. */
  router.post('/:id/pay', async (req, res) => {
    res.json(await retryPayment(ctx, currentUser(req).id, objectIdSchema.parse(req.params.id)));
  });

  return router;
}
