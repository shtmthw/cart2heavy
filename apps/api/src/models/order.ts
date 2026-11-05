import { model, Schema, type Types } from 'mongoose';
import {
  ORDER_STATUSES,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  WEIGHTS,
  type OrderStatus,
  type PaymentProvider,
  type PaymentStatus,
  type Weight,
} from '@cart2heavy/shared';

export interface OrderItemDoc {
  product: Types.ObjectId;
  /** snapshot at purchase time – later edits to the product do not change old orders */
  name: string;
  priceCents: number;
  quantity: number;
  weight: Weight;
  image: string;
}

export interface OrderDoc {
  user: Types.ObjectId;
  email: string;
  items: OrderItemDoc[];
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  address: {
    fullName: string;
    line1: string;
    line2: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: Date; by: Types.ObjectId | null }[];
  payment: {
    provider: PaymentProvider;
    status: PaymentStatus;
    sessionId: string | null;
    paidAt: Date | null;
  };
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<OrderItemDoc>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    priceCents: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    weight: { type: String, enum: WEIGHTS, required: true },
    image: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<OrderDoc>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true },
    items: { type: [orderItemSchema], validate: (v: unknown[]) => v.length > 0 },
    subtotalCents: { type: Number, required: true, min: 0 },
    deliveryCents: { type: Number, required: true, min: 0 },
    totalCents: { type: Number, required: true, min: 0 },
    address: {
      fullName: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String, default: '' },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true },
    },
    status: { type: String, enum: ORDER_STATUSES, default: 'processing', required: true },
    statusHistory: {
      type: [
        new Schema(
          {
            status: { type: String, enum: ORDER_STATUSES, required: true },
            at: { type: Date, required: true },
            by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    payment: {
      provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
      status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', required: true },
      sessionId: { type: String, default: null },
      paidAt: { type: Date, default: null },
    },
  },
  { timestamps: true }, // createdAt is set per document – the old `default: Date.now()` ran once at boot
);
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.status': 1, createdAt: -1 });
orderSchema.index({ 'payment.sessionId': 1 }, { sparse: true });

export const Order = model<OrderDoc>('Order', orderSchema);
