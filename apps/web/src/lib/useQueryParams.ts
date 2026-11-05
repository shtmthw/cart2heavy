import { useSearchParams } from 'react-router';

/**
 * The URL's query string as the single source of truth for filters, sorting and paging.
 * `update` changes some keys (`undefined` or '' removes one) on top of the CURRENT address, so two
 * quick changes in a row never overwrite each other with a stale copy.
 */
export function useQueryParams() {
  const [params, setParams] = useSearchParams();
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  };
  return [params, update] as const;
}
