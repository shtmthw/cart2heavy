import { ChevronDown, LogOut, Package, Settings, Shield, Truck } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Avatar } from '../../components/ui/avatar';
import { ButtonLink } from '../../components/ui/button';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';

function MenuLink({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link
      to={to}
      role="menuitem"
      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {icon}
      {children}
    </Link>
  );
}

export function AccountMenu() {
  const { user, isLoading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (isLoading) return <div className="h-9 w-20" aria-hidden />;

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <ButtonLink to="/login" variant="ghost" size="sm">
          Log in
        </ButtonLink>
        <ButtonLink to="/register" size="sm" className="hidden sm:inline-flex">
          Sign up
        </ButtonLink>
      </div>
    );
  }

  const icon = 'size-4 text-zinc-500';
  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 items-center gap-2 rounded-md px-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        <Avatar name={user.name} src={user.avatarUrl} />
        <span className="hidden max-w-28 truncate text-sm sm:block">{user.name}</span>
        <ChevronDown className="size-4 text-zinc-500" aria-hidden />
        <span className="sr-only">Account menu</span>
      </button>
      {open && (
        <div
          role="menu"
          onClick={() => setOpen(false)}
          className="animate-pop absolute right-0 z-30 mt-2 w-56 origin-top-right overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-zinc-500">{user.email}</p>
          </div>
          {user.role === 'admin' && (
            <MenuLink to="/admin" icon={<Shield className={icon} aria-hidden />}>
              Admin panel
            </MenuLink>
          )}
          {user.role === 'logistics' && (
            <MenuLink to="/logistics" icon={<Truck className={icon} aria-hidden />}>
              Logistics panel
            </MenuLink>
          )}
          <MenuLink to="/orders" icon={<Package className={icon} aria-hidden />}>
            My orders
          </MenuLink>
          <MenuLink to="/account" icon={<Settings className={icon} aria-hidden />}>
            Account
          </MenuLink>
          <button
            type="button"
            role="menuitem"
            onClick={() =>
              logout.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })
            }
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <LogOut className={icon} aria-hidden />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
