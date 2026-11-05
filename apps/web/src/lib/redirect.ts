import type { NavigateFunction } from 'react-router';

/** Follows a URL returned by the API: stay inside the app when it is ours, leave for the payment page when not. */
export function followUrl(url: string, navigate: NavigateFunction) {
  const target = new URL(url, window.location.origin);
  if (target.origin === window.location.origin) {
    void navigate(`${target.pathname}${target.search}`);
  } else {
    window.location.assign(target.toString());
  }
}

/** Only allow redirects to paths inside this site (no `//evil.example`, no full URLs). */
export function safeNext(value: string | null): string | null {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : null;
}
