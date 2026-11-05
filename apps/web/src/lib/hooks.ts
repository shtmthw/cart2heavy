import { useEffect, useState } from 'react';

/** The value, but only after it stopped changing for `delay` ms (for search-as-you-type). */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · cart2heavy` : 'cart2heavy';
  }, [title]);
}
