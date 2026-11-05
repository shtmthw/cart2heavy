import type { Types } from 'mongoose';
import {
  WEIGHTS,
  type CartDTO,
  type CartLineDTO,
  type CategoryDTO,
  type OrderDTO,
  type ProductDTO,
  type UserDTO,
  type Weight,
} from '@cart2heavy/shared';
import type { CategoryDoc, OrderDoc, ProductDoc, UserDoc } from './models';

export type WithId<T> = T & { _id: Types.ObjectId };

export const avatarUrl = (file: string | null) => (file ? `/uploads/avatars/${file}` : null);
export const productImageUrl = (file: string) => `/uploads/products/${file}`;

export function toUserDTO(user: WithId<Omit<UserDoc, 'passwordHash' | 'cart'>>): UserDTO {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: avatarUrl(user.avatar),
    createdAt: user.createdAt.toISOString(),
  };
}

export function toCategoryDTO(category: WithId<CategoryDoc>, productCount?: number): CategoryDTO {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    weight: category.weight,
    ...(productCount === undefined ? {} : { productCount }),
  };
}

/** A product whose `category` has been populated (or is gone). */
export type ProductWithCategory = WithId<Omit<ProductDoc, 'category'>> & {
  category: WithId<CategoryDoc> | null;
};

export function toProductDTO(product: ProductWithCategory): ProductDTO {
  const { category } = product;
  return {
    id: product._id.toString(),
    name: product.name,
    description: product.description,
    priceCents: product.priceCents,
    imageUrl: productImageUrl(product.image),
    category: category
      ? {
          id: category._id.toString(),
          name: category.name,
          slug: category.slug,
          weight: category.weight,
        }
      : null,
    totalBought: product.totalBought,
    isActive: product.isActive,
    createdAt: product.createdAt.toISOString(),
  };
}

export interface CartLineInput {
  product: Pick<ProductWithCategory, '_id' | 'name' | 'priceCents' | 'image' | 'isActive'>;
  quantity: number;
}

export function toCartLineDTO(line: CartLineInput): CartLineDTO {
  return {
    product: {
      id: line.product._id.toString(),
      name: line.product.name,
      priceCents: line.product.priceCents,
      imageUrl: productImageUrl(line.product.image),
      isActive: line.product.isActive,
    },
    quantity: line.quantity,
    lineTotalCents: line.product.isActive ? line.product.priceCents * line.quantity : 0,
  };
}

export function toCartDTO(
  lines: CartLineInput[],
  totals: Pick<
    CartDTO,
    'subtotalCents' | 'deliveryCents' | 'totalCents' | 'minOrderCents' | 'meetsMinimum'
  >,
): CartDTO {
  return {
    items: lines.map(toCartLineDTO),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    ...totals,
  };
}

/** The heaviest package size among the items – what logistics has to plan for. */
export function heaviestWeight(weights: Weight[]): Weight {
  return weights.reduce<Weight>(
    (max, w) => (WEIGHTS.indexOf(w) > WEIGHTS.indexOf(max) ? w : max),
    'small',
  );
}

export type OrderWithCustomer = WithId<Omit<OrderDoc, 'user'>> & {
  user: Types.ObjectId | WithId<Pick<UserDoc, 'name' | 'email'>>;
};

function isPopulatedUser(
  user: OrderWithCustomer['user'],
): user is WithId<Pick<UserDoc, 'name' | 'email'>> {
  return typeof user === 'object' && 'email' in user;
}

export function toOrderDTO(
  order: OrderWithCustomer,
  names: ReadonlyMap<string, string> = new Map(),
): OrderDTO {
  return {
    id: order._id.toString(),
    email: order.email,
    items: order.items.map((item) => ({
      productId: item.product.toString(),
      name: item.name,
      priceCents: item.priceCents,
      quantity: item.quantity,
      weight: item.weight,
      imageUrl: productImageUrl(item.image),
      lineTotalCents: item.priceCents * item.quantity,
    })),
    subtotalCents: order.subtotalCents,
    deliveryCents: order.deliveryCents,
    totalCents: order.totalCents,
    address: { ...order.address },
    status: order.status,
    statusHistory: order.statusHistory.map((event) => ({
      status: event.status,
      at: event.at.toISOString(),
      by: event.by ? (names.get(event.by.toString()) ?? null) : null,
    })),
    payment: {
      provider: order.payment.provider,
      status: order.payment.status,
      paidAt: order.payment.paidAt ? order.payment.paidAt.toISOString() : null,
    },
    packageSize: heaviestWeight(order.items.map((item) => item.weight)),
    ...(isPopulatedUser(order.user)
      ? {
          customer: {
            id: order.user._id.toString(),
            name: order.user.name,
            email: order.user.email,
          },
        }
      : {}),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
