import { Router } from 'express';
import { categoryInputSchema, objectIdSchema } from '@cart2heavy/shared';
import { createCategory, deleteCategory, listCategories, updateCategory } from './service';

/** GET /api/categories – public, with the number of products a shopper can see. */
export function categoryRoutes(): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await listCategories(true));
  });
  return router;
}

/** /api/admin/categories */
export function adminCategoryRoutes(): Router {
  const router = Router();
  router.get('/', async (_req, res) => {
    res.json(await listCategories(false));
  });
  router.post('/', async (req, res) => {
    res.status(201).json(await createCategory(categoryInputSchema.parse(req.body)));
  });
  router.patch('/:id', async (req, res) => {
    const id = objectIdSchema.parse(req.params.id);
    res.json(await updateCategory(id, categoryInputSchema.parse(req.body)));
  });
  router.delete('/:id', async (req, res) => {
    await deleteCategory(objectIdSchema.parse(req.params.id));
    res.status(204).end();
  });
  return router;
}
