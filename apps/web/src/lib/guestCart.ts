import { LIMITS } from '@cart2heavy/shared';

/** The cart of a visitor who is not logged in: kept in the browser, merged into the account on login. */
export interface GuestLine {
  productId: string;
  quantity: number;
}

const KEY = 'c2h.cart';
const listeners = new Set<() => void>();

function read(): GuestLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is GuestLine =>
        typeof l === 'object' &&
        l !== null &&
        typeof (l as GuestLine).productId === 'string' &&
        Number.isInteger((l as GuestLine).quantity) &&
        (l as GuestLine).quantity > 0,
    );
  } catch {
    return [];
  }
}

// useSyncExternalStore needs a stable value between changes, so keep one array around
let lines: GuestLine[] = read();

function emit() {
  for (const listener of listeners) listener();
}

function write(next: GuestLine[]) {
  lines = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full or blocked: the cart still works for this page view
  }
  emit();
}

// another tab changed the cart
window.addEventListener('storage', (event) => {
  if (event.key === KEY) {
    lines = read();
    emit();
  }
});

export const guestCart = {
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getSnapshot: () => lines,
  setQuantity: (productId: string, quantity: number) => {
    const capped = Math.min(Math.max(1, Math.trunc(quantity)), LIMITS.maxCartQuantity);
    const exists = lines.some((l) => l.productId === productId);
    write(
      exists
        ? lines.map((l) => (l.productId === productId ? { ...l, quantity: capped } : l))
        : [...lines, { productId, quantity: capped }].slice(0, LIMITS.maxCartLines),
    );
  },
  remove: (productId: string) => {
    write(lines.filter((l) => l.productId !== productId));
  },
  clear: () => {
    write([]);
  },
};
