import { z } from 'zod';
import { LIMITS, ORDER_STATUSES, PAYMENT_STATUSES, PRODUCT_SORTS, WEIGHTS } from './constants';
import { LOGISTICS_STATUSES } from './order-status';

/* ---------- primitives ---------- */

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const trimmed = (min: number, max: number, what: string) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${what} is required` : `${what} must be at least ${min} characters`)
    .max(max, `${what} must be at most ${max} characters`);

/** multipart/form-data sends every field as text, JSON sends real booleans – accept both. */
const booleanLike = z.union([
  z.boolean(),
  z.enum(['true', 'false']).transform((v) => v === 'true'),
]);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSizeMax).default(LIMITS.pageSizeDefault),
});

/* ---------- auth & account ---------- */

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email('Enter a valid email'));

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Password must be at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax, `Password must be at most ${LIMITS.passwordMax} characters`);

export const registerSchema = z.object({
  name: trimmed(2, 60, 'Name'),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({ name: trimmed(2, 60, 'Name') });
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required').max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/* ---------- catalog ---------- */

export const weightSchema = z.enum(WEIGHTS);

export const categoryInputSchema = z.object({
  name: trimmed(2, 40, 'Name'),
  weight: weightSchema,
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const productQuerySchema = paginationSchema.extend({
  /** category slug */
  category: z.string().trim().min(1).max(80).optional(),
  q: z.string().trim().min(1).max(80).optional(),
  sort: z.enum(PRODUCT_SORTS).default('newest'),
  /** comma separated ids – used to show a guest's cart */
  ids: z
    .string()
    .transform((v) => v.split(',').filter(Boolean))
    .pipe(z.array(objectIdSchema).max(LIMITS.maxCartLines))
    .optional(),
});
export type ProductQuery = z.input<typeof productQuerySchema>;

export const suggestQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });

const priceCentsSchema = z.coerce
  .number()
  .int('Price must be a whole number of cents')
  .min(1, 'Price must be at least 1 cent')
  .max(LIMITS.maxPriceCents, 'Price is too high');

/** Body of POST /admin/products (multipart: the image comes as a file next to these fields). */
export const productInputSchema = z.object({
  name: trimmed(2, 120, 'Name'),
  description: trimmed(1, 2000, 'Description'),
  priceCents: priceCentsSchema,
  category: objectIdSchema,
  isActive: booleanLike.optional(),
});
export type ProductInput = z.infer<typeof productInputSchema>;

export const productUpdateSchema = productInputSchema.partial();
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;

/* ---------- cart ---------- */

export const quantitySchema = z.coerce
  .number()
  .int()
  .min(1, 'Quantity must be at least 1')
  .max(LIMITS.maxCartQuantity, `You can order at most ${LIMITS.maxCartQuantity} of an item`);

export const setCartItemSchema = z.object({ quantity: quantitySchema });

export const mergeCartSchema = z.object({
  items: z
    .array(z.object({ productId: objectIdSchema, quantity: quantitySchema }))
    .max(LIMITS.maxCartLines),
});
export type MergeCartInput = z.infer<typeof mergeCartSchema>;

/* ---------- checkout & orders ---------- */

export const addressSchema = z.object({
  fullName: trimmed(2, 80, 'Full name'),
  line1: trimmed(3, 120, 'Address'),
  line2: z.string().trim().max(120).optional().default(''),
  city: trimmed(2, 80, 'City'),
  postalCode: trimmed(2, 20, 'Postal code'),
  country: trimmed(2, 60, 'Country'),
  phone: z
    .string()
    .trim()
    .regex(/^[+()\d\s-]{6,20}$/, 'Enter a valid phone number'),
});
export type AddressInput = z.infer<typeof addressSchema>;

export const checkoutSchema = z.object({ address: addressSchema });
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const adminOrdersQuerySchema = paginationSchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  payment: z.enum(PAYMENT_STATUSES).optional(),
});
export type AdminOrdersQuery = z.input<typeof adminOrdersQuerySchema>;

export const logisticsOrdersQuerySchema = z.object({
  status: z.enum(LOGISTICS_STATUSES).optional(),
});
export type LogisticsOrdersQuery = z.input<typeof logisticsOrdersQuerySchema>;

export const logisticsStatusSchema = z.object({ status: z.enum(LOGISTICS_STATUSES) });
export type LogisticsStatusInput = z.infer<typeof logisticsStatusSchema>;
