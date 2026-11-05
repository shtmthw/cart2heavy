import { NavLink, Outlet, ScrollRestoration, useLocation } from 'react-router';
import { cn } from '../../lib/utils';
import { AccountMenu } from './AccountMenu';

const link = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex-1 rounded-full px-2 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors sm:flex-none sm:px-3.5 sm:py-1.5',
    isActive ? 'bg-accent-soft text-accent' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100',
  );

/** Shared frame of the staff areas (admin and logistics): title, tabs, link back to the shop. */
export function StaffLayout({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string; end?: boolean }[];
}) {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-2.5 sm:py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <NavLink to="/" className="font-logo text-xl font-bold tracking-tight sm:text-2xl">
                cart<span className="text-accent">2</span>heavy
              </NavLink>
              <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-400">
                {title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <NavLink
                to="/"
                className="hidden text-sm text-zinc-500 hover:text-zinc-900 sm:block dark:hover:text-zinc-100"
              >
                View shop
              </NavLink>
              <AccountMenu />
            </div>
          </div>
          {links.length > 1 && (
            <nav
              aria-label={`${title} sections`}
              className="no-scrollbar -mx-1 mt-2.5 flex gap-1 overflow-x-auto"
            >
              {links.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end ?? false} className={link}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>
      <main key={pathname} className="animate-fade-up flex-1 py-8">
        <Outlet />
      </main>
      <ScrollRestoration />
    </div>
  );
}

export function AdminLayout() {
  return (
    <StaffLayout
      title="Admin"
      links={[
        { to: '/admin', label: 'Dashboard', end: true },
        { to: '/admin/products', label: 'Products' },
        { to: '/admin/categories', label: 'Categories' },
        { to: '/admin/orders', label: 'Orders' },
      ]}
    />
  );
}

export function LogisticsLayout() {
  return (
    <StaffLayout title="Logistics" links={[{ to: '/logistics', label: 'Queue', end: true }]} />
  );
}
