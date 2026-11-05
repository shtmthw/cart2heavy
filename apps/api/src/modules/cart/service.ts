import { LIMITS, type CartDTO, type MergeCartInput } from '@cart2heavy/shared';
import type { AppConfig } from '../../config/env';
import { toCartDTO, type CartLineInput } from '../../dto';
import { HttpError } from '../../errors';
import { Product, User } from '../../models';
import { priceCart } from '@cart2heavy/shared';

/** The user's cart with live product data and totals. Lines whose product was deleted are dropped. */
export async function getCart(config: AppConfig, userId: string): Promise<CartDTO> {
  const user = await User.findById(userId).select('cart').lean();
  if (!user) throw HttpError.unauthorized();

  const products = await Product.find({ _id: { $in: user.cart.map((l) => l.product) } })
    .select('name priceCents image isActive')
    .lean();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const lines: CartLineInput[] = [];
  const gone: string[] = [];
  for (const line of user.cart) {
    const product = byId.get(line.product.toString());
    if (product) lines.push({ product, quantity: line.quantity });
    else gone.push(line.product.toString());
  }
  if (gone.length > 0) {
    await User.updateOne({ _id: userId }, { $pull: { cart: { product: { $in: gone } } } });
  }

  const totals = priceCart(
    lines.map((l) => ({
      priceCents: l.product.priceCents,
      quantity: l.quantity,
      isActive: l.product.isActive,
    })),
    config,
  );
  return toCartDTO(lines, totals);
}

async function requireActiveProduct(productId: string) {
  const product = await Product.exists({ _id: productId, isActive: true });
  if (!product) throw HttpError.notFound('Product');
}

export async function setCartQuantity(
  config: AppConfig,
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartDTO> {
  await requireActiveProduct(productId);

  const updated = await User.updateOne(
    { _id: userId, 'cart.product': productId },
    { $set: { 'cart.$.quantity': quantity } },
  );
  if (updated.matchedCount === 0) {
    const pushed = await User.updateOne(
      {
        _id: userId,
        'cart.product': { $ne: productId },
        [`cart.${LIMITS.maxCartLines - 1}`]: { $exists: false },
      },
      { $push: { cart: { product: productId, quantity } } },
    );
    if (pushed.matchedCount === 0) {
      throw HttpError.badRequest(
        `Your cart can hold at most ${LIMITS.maxCartLines} different items`,
      );
    }
  }
  return getCart(config, userId);
}

export async function removeFromCart(config: AppConfig, userId: string, productId: string) {
  await User.updateOne({ _id: userId }, { $pull: { cart: { product: productId } } });
  return getCart(config, userId);
}

/** Adds the lines of a guest's (browser-only) cart to the account's cart after login. */
export async function mergeCart(config: AppConfig, userId: string, input: MergeCartInput) {
  const wanted = new Map<string, number>();
  for (const line of input.items) {
    wanted.set(line.productId, (wanted.get(line.productId) ?? 0) + line.quantity);
  }

  const active = await Product.find({ _id: { $in: [...wanted.keys()] }, isActive: true })
    .select('_id')
    .lean();
  const activeIds = new Set(active.map((p) => p._id.toString()));

  const user = await User.findById(userId).select('cart');
  if (!user) throw HttpError.unauthorized();

  for (const [productId, quantity] of wanted) {
    if (!activeIds.has(productId)) continue; // silently skip products that no longer exist
    const existing = user.cart.find((l) => l.product.toString() === productId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, LIMITS.maxCartQuantity);
    } else if (user.cart.length < LIMITS.maxCartLines) {
      user.cart.push({
        product: productId as unknown as (typeof user.cart)[number]['product'],
        quantity: Math.min(quantity, LIMITS.maxCartQuantity),
      });
    }
  }
  await user.save();
  return getCart(config, userId);
}
