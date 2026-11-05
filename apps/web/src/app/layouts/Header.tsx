import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { SearchBox } from '../../features/search/SearchBox';
import { useCart } from '../../lib/cart';
import { AccountMenu } from './AccountMenu';

export function Header() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-8 sm:py-4">
        <Link
          to="/"
          className="font-logo text-3xl font-bold tracking-tight transition-opacity hover:opacity-80 sm:text-[2.1rem]"
        >
          cart<span className="text-accent">2</span>heavy
        </Link>
        <SearchBox className="order-last w-full sm:order-none sm:ml-8 sm:max-w-md sm:flex-1" />
        <nav aria-label="Account and cart" className="ml-auto flex items-center gap-1">
          <Link
            to="/cart"
            aria-label={
              count > 0 ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart, empty'
            }
            className="relative grid size-10 place-items-center rounded-full transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ShoppingCart className="size-5" aria-hidden />
            {count > 0 && (
              <span
                aria-hidden
                className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] leading-4 font-semibold text-ink"
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </Link>
          <AccountMenu />
        </nav>
      </div>
    </header>
  );
}
