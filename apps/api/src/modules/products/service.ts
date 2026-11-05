import type { QueryFilter, SortOrder } from 'mongoose';
import type {
  Paginated,
  ProductDTO,
  ProductQuery,
  ProductSuggestionDTO,
  productInputSchema,
  productQuerySchema,
} from '@cart2heavy/shared';
import type { z } from 'zod';
import type { AppConfig } from '../../config/env';
import { productImageUrl, toProductDTO, type ProductWithCategory, type WithId } from '../../dto';
import { HttpError } from '../../errors';
import { removeUpload } from '../../middleware/upload';
import { Category, Order, Product, User, type CategoryDoc, type ProductDoc } from '../../models';

type ParsedQuery = z.output<typeof productQuerySchema>;
type ProductInput = z.output<typeof productInputSchema>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const SORTS: Record<ParsedQuery['sort'], Record<string, SortOrder>> = {
  newest: { createdAt: -1, _id: -1 },
  popular: { totalBought: -1, createdAt: -1, _id: -1 },
  price_asc: { priceCents: 1, _id: 1 },
  price_desc: { priceCents: -1, _id: -1 },
};

/** Lists products. `includeInactive` is only for the admin panel. */
export async function listProducts(
  query: ParsedQuery,
  { includeInactive = false }: { includeInactive?: boolean } = {},
): Promise<Paginated<ProductDTO>> {
  const filter: QueryFilter<ProductDoc> = includeInactive ? {} : { isActive: true };

  if (query.category) {
    const category = await Category.findOne({ slug: query.category }).select('_id').lean();
    // an unknown category is not an error, it just has no products
    filter.category = category?._id ?? null;
  }
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: pattern }, { description: pattern }];
  }
  if (query.ids) filter._id = { $in: query.ids };

  const [total, products] = await Promise.all([
    Product.countDocuments(filter),
    Product.find(filter)
      .sort(SORTS[query.sort])
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate<{ category: WithId<CategoryDoc> | null }>('category', 'name slug weight')
      .lean(),
  ]);

  return {
    items: products.map((p) => toProductDTO(p as ProductWithCategory)),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

export async function suggestProducts(q: string): Promise<ProductSuggestionDTO[]> {
  const pattern = new RegExp(escapeRegex(q), 'i');
  const products = await Product.find({ isActive: true, name: pattern })
    // names that start with the query come first
    .sort({ totalBought: -1, name: 1 })
    .limit(20)
    .select('name priceCents image')
    .lean();
  const lower = q.toLowerCase();
  return products
    .sort(
      (a, b) =>
        Number(b.name.toLowerCase().startsWith(lower)) -
        Number(a.name.toLowerCase().startsWith(lower)),
    )
    .slice(0, 6)
    .map((p) => ({
      id: p._id.toString(),
      name: p.name,
      priceCents: p.priceCents,
      imageUrl: productImageUrl(p.image),
    }));
}

export async function getProduct(
  id: string,
  { includeInactive = false } = {},
): Promise<ProductDTO> {
  const product = await Product.findOne(includeInactive ? { _id: id } : { _id: id, isActive: true })
    .populate<{ category: WithId<CategoryDoc> | null }>('category', 'name slug weight')
    .lean();
  if (!product) throw HttpError.notFound('Product');
  return toProductDTO(product);
}

async function assertCategoryExists(id: string) {
  if (!(await Category.exists({ _id: id }))) {
    throw HttpError.badRequest('That category does not exist', {
      category: ['Choose an existing category'],
    });
  }
}

export async function createProduct(input: ProductInput, image: string): Promise<ProductDTO> {
  await assertCategoryExists(input.category);
  const product = await Product.create({
    name: input.name,
    description: input.description,
    priceCents: input.priceCents,
    category: input.category,
    isActive: input.isActive ?? true,
    image,
  });
  return getProduct(product.id, { includeInactive: true });
}

export async function updateProduct(
  config: AppConfig,
  id: string,
  input: Partial<ProductInput>,
  newImage?: string,
): Promise<ProductDTO> {
  const product = await Product.findById(id);
  if (!product) throw HttpError.notFound('Product');
  if (input.category) await assertCategoryExists(input.category);

  const previousImage = product.image;
  const { name, description, priceCents, category, isActive } = input;
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (priceCents !== undefined) product.priceCents = priceCents;
  if (category !== undefined) product.category = category as unknown as typeof product.category;
  if (isActive !== undefined) product.isActive = isActive;
  if (newImage) product.image = newImage;
  await product.save();

  if (newImage) await removeUpload(config, 'products', previousImage);
  return getProduct(id, { includeInactive: true });
}

/**
 * Deletes a product for good when nobody ever ordered it; otherwise only hides it, so old orders
 * keep their history. Either way it disappears from the shop.
 */
export async function deleteProduct(config: AppConfig, id: string): Promise<'deleted' | 'hidden'> {
  const product = await Product.findById(id);
  if (!product) throw HttpError.notFound('Product');

  if (await Order.exists({ 'items.product': product._id })) {
    product.isActive = false;
    await product.save();
    return 'hidden';
  }
  await product.deleteOne();
  await User.updateMany(
    { 'cart.product': product._id },
    { $pull: { cart: { product: product._id } } },
  );
  await removeUpload(config, 'products', product.image);
  return 'deleted';
}

export type { ProductQuery };
