import { model, Schema } from 'mongoose';
import { WEIGHTS, type Weight } from '@cart2heavy/shared';

export interface CategoryDoc {
  name: string;
  slug: string;
  weight: Weight;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<CategoryDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, unique: true },
    weight: { type: String, enum: WEIGHTS, required: true },
  },
  { timestamps: true },
);
// "Phones" and "phones" are the same category
categorySchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const Category = model<CategoryDoc>('Category', categorySchema);
