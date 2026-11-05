export const ROLES = ['customer', 'admin', 'logistics'] as const;
export type Role = (typeof ROLES)[number];

/** Package size of a category: what the old "S / M / B / L" field meant. */
export const WEIGHTS = ['small', 'medium', 'big', 'large'] as const;
export type Weight = (typeof WEIGHTS)[number];

export const WEIGHT_LABELS: Record<Weight, { code: string; label: string; hint: string }> = {
  small: { code: 'S', label: 'Small', hint: 'Fits in an envelope or small box (e.g. phones)' },
  medium: { code: 'M', label: 'Medium', hint: 'Shoebox size (e.g. motherboards)' },
  big: { code: 'B', label: 'Big', hint: 'Large box, one person can carry it (e.g. laptops)' },
  large: { code: 'L', label: 'Large', hint: 'Oversized, pallet or two people (e.g. desktops)' },
};

export const ORDER_STATUSES = [
  'processing',
  'confirmed',
  'received',
  'shipping',
  'shipped',
  'out_for_delivery',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['mock', 'stripe'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PRODUCT_SORTS = ['newest', 'popular', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const ERROR_CODES = [
  'validation_error',
  'bad_request',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'min_order',
  'payment_error',
  'payload_too_large',
  'internal_error',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const CURRENCY = 'USD';

/** Limits shared by the forms (web) and the validation (API). */
export const LIMITS = {
  passwordMin: 8,
  /** bcrypt only looks at the first 72 bytes */
  passwordMax: 72,
  maxCartQuantity: 99,
  maxCartLines: 50,
  maxPriceCents: 10_000_000, // $100,000.00
  pageSizeDefault: 12,
  pageSizeMax: 50,
  avatarMaxBytes: 5 * 1024 * 1024,
  productImageMaxBytes: 5 * 1024 * 1024,
} as const;
