import { model, Schema, type Types } from 'mongoose';
import { ROLES, type Role } from '@cart2heavy/shared';

export interface CartItem {
  product: Types.ObjectId;
  quantity: number;
}

export interface UserDoc {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  /** file name inside uploads/avatars, or null (the UI then shows initials) */
  avatar: string | null;
  cart: CartItem[];
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<CartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: 1, max: 99 },
  },
  { _id: false },
);

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'customer', required: true },
    avatar: { type: String, default: null },
    cart: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true },
);

export const User = model<UserDoc>('User', userSchema);
