import { Router } from 'express';
import { mergeCartSchema, objectIdSchema, setCartItemSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { currentUser, requireAuth } from '../../middleware/auth';
import { getCart, mergeCart, removeFromCart, setCartQuantity } from './service';

/** /api/cart – the cart lives on the server, per user. */
export function cartRoutes({ config }: AppContext): Router {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    res.json(await getCart(config, currentUser(req).id));
  });

  router.put('/items/:productId', async (req, res) => {
    const productId = objectIdSchema.parse(req.params.productId);
    const { quantity } = setCartItemSchema.parse(req.body);
    res.json(await setCartQuantity(config, currentUser(req).id, productId, quantity));
  });

  router.delete('/items/:productId', async (req, res) => {
    const productId = objectIdSchema.parse(req.params.productId);
    res.json(await removeFromCart(config, currentUser(req).id, productId));
  });

  router.post('/merge', async (req, res) => {
    res.json(await mergeCart(config, currentUser(req).id, mergeCartSchema.parse(req.body)));
  });

  return router;
}
