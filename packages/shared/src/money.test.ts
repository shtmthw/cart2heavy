import { describe, expect, it } from 'vitest';
import { centsToDecimal, formatCents, toCents } from './money';

describe('money', () => {
  it('formats cents as dollars', () => {
    expect(formatCents(180)).toBe('$1.80');
    expect(formatCents(250_000)).toBe('$2,500.00');
    expect(formatCents(0)).toBe('$0.00');
  });

  it('parses dollar strings into cents without float drift', () => {
    expect(toCents('12')).toBe(1200);
    expect(toCents('12.3')).toBe(1230);
    expect(toCents('12.34')).toBe(1234);
    expect(toCents('0.07')).toBe(7);
    expect(toCents(19.99)).toBe(1999);
    expect(toCents(1.1)).toBe(110);
  });

  it('rejects things that are not money', () => {
    expect(toCents('')).toBeNull();
    expect(toCents('abc')).toBeNull();
    expect(toCents('-1')).toBeNull();
    expect(toCents('1.234')).toBeNull();
    expect(toCents(Number.NaN)).toBeNull();
    expect(toCents(1.005)).toBeNull();
  });

  it('turns cents back into an input friendly string', () => {
    expect(centsToDecimal(1234)).toBe('12.34');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(centsToDecimal(1200)).toBe('12.00');
  });
});
