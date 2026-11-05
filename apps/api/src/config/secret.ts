import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import type { AppConfig } from './env';

/**
 * Without a JWT_SECRET the server makes up a random one the first time it starts and keeps it in
 * the database, so sessions survive restarts and every installation has its own secret
 * (no well-known default that would let anybody forge a login). `$setOnInsert` makes the first
 * writer win when several instances start at once.
 */
export async function ensureJwtSecret(config: AppConfig): Promise<AppConfig> {
  if (!config.jwtSecretFromDatabase) return config;
  const settings = mongoose.connection.collection<{ _id: string; value: string }>('settings');
  const doc = await settings.findOneAndUpdate(
    { _id: 'jwtSecret' },
    { $setOnInsert: { value: randomBytes(48).toString('base64url') } },
    { upsert: true, returnDocument: 'after' },
  );
  if (!doc) throw new Error('Could not load the session secret from the database');
  return { ...config, jwtSecret: doc.value };
}
