import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config/env';
import { ensureJwtSecret } from '../src/config/secret';
import { useTestApp } from './helpers';

const base = {
  MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
  JWT_SECRET: 'a-long-enough-secret-value',
};

describe('loadConfig', () => {
  it('applies the defaults of the shop rules', () => {
    const config = loadConfig(base);
    expect(config).toMatchObject({
      port: 8080,
      deliveryCents: 180,
      minOrderCents: 2500,
      payment: { provider: 'mock' },
      seedOnStart: false,
      secureCookies: false,
    });
  });

  it('fails with a readable list of everything that is wrong', () => {
    const error = (() => {
      try {
        loadConfig({ PORT: 'abc', JWT_SECRET: 'short', PAYMENT_PROVIDER: 'paypal' });
      } catch (e) {
        return e;
      }
    })();
    expect(error).toBeInstanceOf(ConfigError);
    const message = (error as ConfigError).message;
    expect(message).toContain('MONGODB_URI');
    expect(message).toContain('JWT_SECRET: must be at least 16 characters');
    expect(message).toContain('PORT');
    expect(message).toContain('PAYMENT_PROVIDER');
  });

  it('treats empty values (docker compose passes them) as not set', () => {
    const config = loadConfig({
      ...base,
      STRIPE_SECRET_KEY: '',
      PAYMENT_PROVIDER: '',
      SMTP_HOST: '',
    });
    expect(config.payment).toMatchObject({ provider: 'mock', stripeSecretKey: undefined });
    expect(config.mail.host).toBeUndefined();
  });

  it('switches to Stripe when a key is present, and insists on a key for PAYMENT_PROVIDER=stripe', () => {
    expect(loadConfig({ ...base, STRIPE_SECRET_KEY: 'sk_test_1' }).payment.provider).toBe('stripe');
    expect(() => loadConfig({ ...base, PAYMENT_PROVIDER: 'stripe' })).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('only marks cookies Secure on an https site', () => {
    expect(loadConfig({ ...base, APP_URL: 'https://shop.example.com/' })).toMatchObject({
      secureCookies: true,
      appUrl: 'https://shop.example.com',
    });
  });
});

describe('ensureJwtSecret', () => {
  useTestApp();

  it('keeps a configured secret as it is', async () => {
    const config = loadConfig(base);
    expect((await ensureJwtSecret(config)).jwtSecret).toBe(base.JWT_SECRET);
  });

  it('creates a random secret once and returns the same one every time after', async () => {
    const config = loadConfig({ MONGODB_URI: base.MONGODB_URI });
    expect(config.jwtSecret).toBe('');
    const [a, b] = await Promise.all([ensureJwtSecret(config), ensureJwtSecret(config)]);
    expect(a.jwtSecret).toHaveLength(64);
    expect(b.jwtSecret).toBe(a.jwtSecret); // two servers starting at once agree
    expect((await ensureJwtSecret(config)).jwtSecret).toBe(a.jwtSecret);
    await mongoose.connection.collection('settings').deleteMany({});
  });
});
