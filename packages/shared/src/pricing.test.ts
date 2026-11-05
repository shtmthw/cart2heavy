import { describe, expect, it } from 'vitest';
import { priceCart } from './pricing';

const rules = { deliveryCents: 180, minOrderCents: 2500 };
const line = (priceCents: number, quantity = 1, isActive = true) => ({
  priceCents,
  quantity,
  isActive,
});

describe('priceCart', () => {
  it('adds up the lines and one delivery fee', () => {
    const totals = priceCart([line(25_000, 1), line(1_999, 3)], rules);
    expect(totals.subtotalCents).toBe(25_000 + 5_997);
    expect(totals.deliveryCents).toBe(180);
    expect(totals.totalCents).toBe(25_000 + 5_997 + 180);
  });

  it('applies the $25 minimum to the items, not to the delivery fee', () => {
    expect(priceCart([line(2_499)], rules).meetsMinimum).toBe(false);
    expect(priceCart([line(2_500)], rules).meetsMinimum).toBe(true);
    expect(priceCart([line(2_320)], rules).meetsMinimum).toBe(false); // 23.20 + 1.80 = 25.00 does not count
  });

  it('charges nothing for an empty cart', () => {
    expect(priceCart([], rules)).toMatchObject({
      subtotalCents: 0,
      deliveryCents: 0,
      totalCents: 0,
      meetsMinimum: false,
    });
  });

  it('does not charge for products that are no longer sold', () => {
    const totals = priceCart([line(10_000, 1), line(50_000, 2, false)], rules);
    expect(totals.subtotalCents).toBe(10_000);
  });

  it('has no float drift', () => {
    expect(priceCart([line(10, 3)], { deliveryCents: 0, minOrderCents: 0 }).subtotalCents).toBe(30);
    expect(priceCart([line(1999, 33)], rules).subtotalCents).toBe(65_967);
  });
});
