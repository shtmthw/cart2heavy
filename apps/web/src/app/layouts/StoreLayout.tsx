import { Outlet, ScrollRestoration } from 'react-router';
import { Footer } from './Footer';
import { Header } from './Header';

export function StoreLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-white focus:px-3 focus:py-2 dark:focus:bg-zinc-900"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1 py-8">
        <Outlet />
      </main>
      <Footer />
      <ScrollRestoration />
    </div>
  );
}
