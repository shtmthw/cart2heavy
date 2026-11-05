import { NavLink, Outlet, ScrollRestoration } from 'react-router';
import { Container } from '../../components/ui/page';
import { cn } from '../../lib/utils';
import { AccountMenu } from './AccountMenu';

const link = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap',
    isActive
      ? 'bg-accent-soft text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200'
      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800',
  );

/** Shared frame of the staff areas (admin and logistics): title, tabs, link back to the shop. */
export function StaffLayout({
  title,
  links,
}: {
  title: string;
  links: { to: string; label: string; end?: boolean }[];
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <Container className="max-w-6xl py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <NavLink to="/" className="text-lg font-semibold tracking-tight">
                cart<span className="text-accent">2</span>heavy
              </NavLink>
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
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
            <nav aria-label={`${title} sections`} className="-mx-1 mt-3 flex gap-1 overflow-x-auto">
              {links.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end ?? false} className={link}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </Container>
      </header>
      <main className="flex-1 py-8">
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
