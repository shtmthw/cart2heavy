import { describe, expect, it } from 'vitest';
import {
  addressSchema,
  loginSchema,
  mergeCartSchema,
  productInputSchema,
  productQuerySchema,
  registerSchema,
} from './schemas';

const oid = '507f1f77bcf86cd799439011';

describe('schemas', () => {
  it('normalises emails and trims names on register', () => {
    const parsed = registerSchema.parse({
      name: '  Matthew ',
      email: '  Matthew@Example.COM ',
      password: 'longenough',
    });
    expect(parsed.name).toBe('Matthew');
    expect(parsed.email).toBe('matthew@example.com');
  });

  it('rejects short passwords and bad emails', () => {
    expect(registerSchema.safeParse({ name: 'Al', email: 'nope', password: 'x' }).success).toBe(
      false,
    );
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('coerces multipart product fields', () => {
    const parsed = productInputSchema.parse({
      name: 'Board',
      description: 'A board',
      priceCents: '25000',
      category: oid,
      isActive: 'false',
    });
    expect(parsed.priceCents).toBe(25000);
    expect(parsed.isActive).toBe(false);
  });

  it('refuses fractional or zero prices', () => {
    const base = { name: 'Board', description: 'A board', category: oid };
    expect(productInputSchema.safeParse({ ...base, priceCents: '10.5' }).success).toBe(false);
    expect(productInputSchema.safeParse({ ...base, priceCents: '0' }).success).toBe(false);
  });

  it('applies defaults to the product query', () => {
    const q = productQuerySchema.parse({});
    expect(q).toMatchObject({ page: 1, limit: 12, sort: 'newest' });
    expect(productQuerySchema.parse({ ids: `${oid},${oid}` }).ids).toEqual([oid, oid]);
    expect(productQuerySchema.safeParse({ ids: 'not-an-id' }).success).toBe(false);
    expect(productQuerySchema.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('validates guest cart merges', () => {
    expect(mergeCartSchema.safeParse({ items: [{ productId: oid, quantity: 2 }] }).success).toBe(
      true,
    );
    expect(mergeCartSchema.safeParse({ items: [{ productId: oid, quantity: 0 }] }).success).toBe(
      false,
    );
  });

  it('requires a full address', () => {
    const ok = {
      fullName: 'Matthew B',
      line1: '1 Main St',
      city: 'Dhaka',
      postalCode: '1200',
      country: 'Bangladesh',
      phone: '+880 1700-000000',
    };
    expect(addressSchema.parse(ok).line2).toBe('');
    expect(addressSchema.safeParse({ ...ok, phone: 'abc' }).success).toBe(false);
  });
});
