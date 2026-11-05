import type { Types } from 'mongoose';
import type { UserDTO } from '@cart2heavy/shared';
import type { UserDoc } from './models';

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
