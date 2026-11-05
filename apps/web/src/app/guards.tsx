import { Navigate, Outlet, useLocation } from 'react-router';
import type { Role } from '@cart2heavy/shared';
import { ButtonLink } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { Spinner } from '../components/ui/skeleton';
import { useAuth } from '../lib/auth';

function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-6" />
    </div>
  );
}

/** Pages that need a login. Sends visitors to the login page and brings them back afterwards. */
export function RequireAuth() {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Pages for one role (admin or logistics). The API enforces the same rule – this is only UX. */
export function RequireRole({ role }: { role: Role }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  if (isLoading) return <Loading />;
  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (user.role !== role) {
    return (
      <EmptyState
        title="You do not have access to this page"
        action={<ButtonLink to="/">Back to the shop</ButtonLink>}
      >
        This area is for {role} accounts.
      </EmptyState>
    );
  }
  return <Outlet />;
}
