import { randomBytes } from 'node:crypto';
import { registerSchema, ROLES, type Role } from '@cart2heavy/shared';
import type { AppConfig } from '../config/env';
import { HttpError } from '../errors';
import { registerCustomer, hashPassword } from '../modules/auth/service';
import { User } from '../models';

export interface NewAccount {
  role: Role;
  email: string;
  name: string;
  /** a random one is generated (and returned) when left out */
  password?: string | undefined;
}

/**
 * Creates an account of any role. Public sign-up can only ever make customers, so this is how a
 * real admin or logistics account is made without the demo data.
 */
export async function createAccount(config: AppConfig, input: NewAccount) {
  if (!ROLES.includes(input.role)) throw new Error(`Role must be one of: ${ROLES.join(', ')}`);
  const password = input.password ?? randomBytes(9).toString('base64url'); // 12 characters
  const parsed = registerSchema.parse({ name: input.name, email: input.email, password });

  if (input.role === 'customer') {
    const user = await registerCustomer(config, parsed);
    return { user, password };
  }
  if (await User.exists({ email: parsed.email })) {
    throw HttpError.conflict('An account with this email already exists');
  }
  const user = await User.create({
    name: parsed.name,
    email: parsed.email,
    passwordHash: await hashPassword(config, parsed.password),
    role: input.role,
  });
  return { user, password };
}
