export interface PricedLine {
  priceCents: number;
  quantity: number;
  /** lines for products that were hidden or removed are not charged */
  isActive: boolean;
}

export interface PricingRules {
  deliveryCents: number;
  minOrderCents: number;
}

export interface CartTotals {
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  minOrderCents: number;
  /** the minimum order applies to the items (subtotal), not to the delivery fee */
  meetsMinimum: boolean;
}

/** The one place where prices are added up. Everything is integer cents. */
export function priceCart(lines: PricedLine[], rules: PricingRules): CartTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => (line.isActive ? sum + line.priceCents * line.quantity : sum),
    0,
  );
  const deliveryCents = subtotalCents > 0 ? rules.deliveryCents : 0;
  return {
    subtotalCents,
    deliveryCents,
    totalCents: subtotalCents + deliveryCents,
    minOrderCents: rules.minOrderCents,
    meetsMinimum: subtotalCents > 0 && subtotalCents >= rules.minOrderCents,
  };
}
