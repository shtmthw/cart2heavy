import { Router } from 'express';
import {
  LIMITS,
  objectIdSchema,
  productInputSchema,
  productQuerySchema,
  productUpdateSchema,
  suggestQuerySchema,
} from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { HttpError } from '../../errors';
import { imageUpload, withUpload } from '../../middleware/upload';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  suggestProducts,
  updateProduct,
} from './service';

/** /api/products – public catalog. */
export function productRoutes(): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    res.json(await listProducts(productQuerySchema.parse(req.query)));
  });

  // must be declared before "/:id"
  router.get('/suggest', async (req, res) => {
    const { q } = suggestQuerySchema.parse(req.query);
    res.json(await suggestProducts(q));
  });

  router.get('/:id', async (req, res) => {
    res.json(await getProduct(objectIdSchema.parse(req.params.id)));
  });

  return router;
}

/** /api/admin/products – the admin sees hidden products too. */
export function adminProductRoutes({ config }: AppContext): Router {
  const router = Router();
  const upload = imageUpload(config, 'products', 'image', LIMITS.productImageMaxBytes);

  router.get('/', async (req, res) => {
    res.json(await listProducts(productQuerySchema.parse(req.query), { includeInactive: true }));
  });

  router.get('/:id', async (req, res) => {
    res.json(await getProduct(objectIdSchema.parse(req.params.id), { includeInactive: true }));
  });

  router.post(
    '/',
    ...upload,
    withUpload(async (req, res) => {
      const input = productInputSchema.parse(req.body);
      if (!req.file) {
        throw HttpError.badRequest('A product photo is required', {
          image: ['A product photo is required'],
        });
      }
      res.status(201).json(await createProduct(input, req.file.filename));
    }),
  );

  router.patch(
    '/:id',
    ...upload,
    withUpload(async (req, res) => {
      const id = objectIdSchema.parse(req.params.id);
      const input = productUpdateSchema.parse(req.body ?? {});
      res.json(await updateProduct(config, id, input, req.file?.filename));
    }),
  );

  router.delete('/:id', async (req, res) => {
    const result = await deleteProduct(config, objectIdSchema.parse(req.params.id));
    res.json({ result });
  });

  return router;
}
