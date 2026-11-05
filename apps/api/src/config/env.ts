import path from 'node:path';
import { z } from 'zod';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@cart2heavy/shared';

/** Treat `FOO=` (empty) the same as "not set" – docker compose passes empty strings for unset values. */
const blankToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;
const optionalString = z.preprocess(blankToUndefined, z.string().optional());
const flag = z.preprocess(
  (value) =>
    typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value,
  z.boolean().default(false),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  APP_URL: z.url().default('http://localhost:8080'),
  MONGODB_URI: z.string().min(1, 'is required, e.g. mongodb://127.0.0.1:27017/cart2heavy'),
  // optional: when it is not set the server creates a random secret and keeps it in the database
  JWT_SECRET: z.preprocess(
    blankToUndefined,
    z.string().min(16, 'must be at least 16 characters (use a long random string)').optional(),
  ),
  UPLOAD_DIR: z.string().default('./uploads'),
  SEED_IMAGES_DIR: z.string().default('./src/seed/images'),
  WEB_DIST: optionalString,
  DELIVERY_FEE_CENTS: z.coerce.number().int().min(0).default(180),
  MIN_ORDER_CENTS: z.coerce.number().int().min(0).default(2500),
  PAYMENT_PROVIDER: z.preprocess(blankToUndefined, z.enum(PAYMENT_PROVIDERS).optional()),
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  MAIL_FROM: z.string().min(3).default('cart2heavy <no-reply@cart2heavy.local>'),
  SEED_ON_START: flag,
  TRUST_PROXY: flag,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  /** public origin of the site, without a trailing slash */
  appUrl: string;
  mongoUri: string;
  /** empty until `ensureJwtSecret` ran when JWT_SECRET is not configured */
  jwtSecret: string;
  /** true when the secret has to be created / loaded from the database at start-up */
  jwtSecretFromDatabase: boolean;
  /** absolute path */
  uploadDir: string;
  /** absolute path of the demo product photos used by the seed */
  seedImagesDir: string;
  /** absolute path of the built web app; when set the API serves it */
  webDist: string | undefined;
  deliveryCents: number;
  minOrderCents: number;
  payment: {
    provider: PaymentProvider;
    stripeSecretKey: string | undefined;
    stripeWebhookSecret: string | undefined;
  };
  mail: { host: string | undefined; port: number; from: string };
  seedOnStart: boolean;
  trustProxy: boolean;
  logLevel: string;
  /** only mark the auth cookie `Secure` when the site is served over https */
  secureCookies: boolean;
  bcryptRounds: number;
}

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

/** Validates environment variables once, at start-up, and fails with a readable message. */
export function loadConfig(source: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`),
    );
  }
  const env = parsed.data;

  const provider: PaymentProvider =
    env.PAYMENT_PROVIDER ?? (env.STRIPE_SECRET_KEY ? 'stripe' : 'mock');
  if (provider === 'stripe' && !env.STRIPE_SECRET_KEY) {
    throw new ConfigError(['STRIPE_SECRET_KEY: is required when PAYMENT_PROVIDER=stripe']);
  }

  const appUrl = env.APP_URL.replace(/\/+$/, '');
  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    appUrl,
    mongoUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET ?? '',
    jwtSecretFromDatabase: !env.JWT_SECRET,
    uploadDir: path.resolve(env.UPLOAD_DIR),
    seedImagesDir: path.resolve(env.SEED_IMAGES_DIR),
    webDist: env.WEB_DIST ? path.resolve(env.WEB_DIST) : undefined,
    deliveryCents: env.DELIVERY_FEE_CENTS,
    minOrderCents: env.MIN_ORDER_CENTS,
    payment: {
      provider,
      stripeSecretKey: env.STRIPE_SECRET_KEY,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    },
    mail: { host: env.SMTP_HOST, port: env.SMTP_PORT, from: env.MAIL_FROM },
    seedOnStart: env.SEED_ON_START,
    trustProxy: env.TRUST_PROXY,
    logLevel: env.LOG_LEVEL,
    secureCookies: appUrl.startsWith('https://'),
    bcryptRounds: env.NODE_ENV === 'test' ? 4 : 10,
  };
}
