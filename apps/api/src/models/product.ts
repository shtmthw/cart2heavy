import { model, Schema, type Types } from 'mongoose';
import { LIMITS } from '@cart2heavy/shared';

export interface ProductDoc {
  name: string;
  description: string;
  priceCents: number;
  /** file name inside uploads/products */
  image: string;
  category: Types.ObjectId;
  totalBought: number;
  /** inactive products are hidden from the shop but kept for old orders */
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<ProductDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    priceCents: {
      type: Number,
      required: true,
      min: 1,
      max: LIMITS.maxPriceCents,
      validate: { validator: Number.isInteger, message: 'priceCents must be an integer' },
    },
    image: { type: String, required: true },
    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    totalBought: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ isActive: 1, totalBought: -1 });
productSchema.index({ isActive: 1, priceCents: 1 });

export const Product = model<ProductDoc>('Product', productSchema);
