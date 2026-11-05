import { CURRENCY } from './constants';

/** 1234 -> "$12.34". Money is always an integer number of cents. */
export function formatCents(cents: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: CURRENCY }).format(
    cents / 100,
  );
}

/**
 * Parses "12", "12.3", "12.34" (or a number) into integer cents without floating point drift.
 * Returns null for anything that is not a non-negative amount with at most two decimals.
 */
export function toCents(amount: string | number): number | null {
  if (typeof amount === 'number') {
    if (!Number.isFinite(amount) || amount < 0) return null;
    const cents = Math.round(amount * 100);
    return Math.abs(amount * 100 - cents) < 1e-6 ? cents : null;
  }
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return null;
  const dollars = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return dollars * 100 + fraction;
}

/** 1234 -> "12.34" (for pre-filling form inputs). */
export function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
