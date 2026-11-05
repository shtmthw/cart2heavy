import bcrypt from 'bcryptjs';
import type { AppConfig } from '../../config/env';
import { HttpError } from '../../errors';
import { User } from '../../models';
import type { LoginInput, RegisterInput } from '@cart2heavy/shared';

/** Used to spend the same time on unknown emails as on wrong passwords (no user enumeration). */
let dummyHash: string | undefined;
async function getDummyHash(rounds: number) {
  dummyHash ??= await bcrypt.hash('not-a-real-password', rounds);
  return dummyHash;
}

export async function registerCustomer(config: AppConfig, input: RegisterInput) {
  const exists = await User.exists({ email: input.email });
  if (exists) throw HttpError.conflict('An account with this email already exists');
  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);
  // the role is never taken from the request: public sign-ups are always customers
  return User.create({ name: input.name, email: input.email, passwordHash, role: 'customer' });
}

export async function verifyLogin(config: AppConfig, input: LoginInput) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const ok = await bcrypt.compare(
    input.password,
    user?.passwordHash ?? (await getDummyHash(config.bcryptRounds)),
  );
  if (!user || !ok) throw new HttpError(401, 'unauthorized', 'Incorrect email or password');
  return user;
}

export function hashPassword(config: AppConfig, password: string) {
  return bcrypt.hash(password, config.bcryptRounds);
}

export function checkPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
