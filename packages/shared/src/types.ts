import type {
  ErrorCode,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  Role,
  Weight,
} from './constants';
import type { AddressInput } from './schemas';

/** What the API sends over the wire (ids are strings, dates are ISO strings). */

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    /** field name -> messages, present for validation errors */
    details?: Record<string, string[]>;
  };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AppConfigDTO {
  currency: string;
  minOrderCents: number;
  deliveryCents: number;
  paymentProvider: PaymentProvider;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl: string | null;
  createdAt: string;
}

export interface CategoryDTO {
  id: string;
  name: string;
  slug: string;
  weight: Weight;
  /** number of active products in the category (only in GET /categories) */
  productCount?: number;
}

export interface ProductDTO {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  category: Pick<CategoryDTO, 'id' | 'name' | 'slug' | 'weight'> | null;
  totalBought: number;
  isActive: boolean;
  createdAt: string;
}

export interface ProductSuggestionDTO {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string;
}

export interface CartLineDTO {
  product: Pick<ProductDTO, 'id' | 'name' | 'priceCents' | 'imageUrl' | 'isActive'>;
  quantity: number;
  lineTotalCents: number;
}

export interface CartDTO {
  items: CartLineDTO[];
  itemCount: number;
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  minOrderCents: number;
  /** subtotal >= minimum order */
  meetsMinimum: boolean;
}

export interface OrderItemDTO {
  productId: string;
  name: string;
  priceCents: number;
  quantity: number;
  weight: Weight;
  imageUrl: string;
  lineTotalCents: number;
}

export interface OrderStatusEventDTO {
  status: OrderStatus;
  at: string;
  /** name of the person who made the change (omitted for the customer / system) */
  by: string | null;
}

export interface OrderDTO {
  id: string;
  email: string;
  items: OrderItemDTO[];
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  address: AddressInput;
  status: OrderStatus;
  statusHistory: OrderStatusEventDTO[];
  payment: {
    provider: PaymentProvider;
    status: PaymentStatus;
    paidAt: string | null;
  };
  /** the heaviest package size in the order, used by logistics */
  packageSize: Weight;
  customer?: { id: string; name: string; email: string };
  createdAt: string;
  updatedAt: string;
}

export interface CheckoutResultDTO {
  orderId: string;
  /** where to send the browser to pay */
  redirectUrl: string;
}

export interface AdminStatsDTO {
  revenueCents: number;
  ordersTotal: number;
  ordersPaid: number;
  ordersByStatus: Record<OrderStatus, number>;
  topProducts: Pick<ProductDTO, 'id' | 'name' | 'imageUrl' | 'totalBought'>[];
}
