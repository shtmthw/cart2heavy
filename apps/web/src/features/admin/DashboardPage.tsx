import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { formatCents, ORDER_STATUS_LABELS, ORDER_STATUSES } from '@cart2heavy/shared';
import { Card } from '../../components/ui/card';
import { ErrorState } from '../../components/ui/empty-state';
import { Container, PageHeader } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { adminStatsQuery } from './queries';

function Stat({
  label,
  value,
  to,
  hint,
}: {
  label: string;
  value: string;
  to?: string;
  hint?: string;
}) {
  const body = (
    <Card className="p-3.5 transition-colors hover:bg-zinc-50 sm:p-4 dark:hover:bg-zinc-800/60">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : <div>{body}</div>;
}

export function DashboardPage() {
  useDocumentTitle('Admin');
  const { data, isPending, error, refetch } = useQuery(adminStatsQuery);

  if (isPending) {
    return (
      <Container>
        <PageHeader title="Dashboard" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </Container>
    );
  }
  if (error) {
    return (
      <Container>
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      </Container>
    );
  }

  const waiting = data.awaitingConfirmation;
  const max = Math.max(1, ...ORDER_STATUSES.map((s) => data.ordersByStatus[s]));
  return (
    <Container>
      <PageHeader title="Dashboard" description="How the shop is doing." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Revenue"
          value={formatCents(data.revenueCents)}
          hint="Paid orders, without cancelled ones"
        />
        <Stat label="Orders" value={String(data.ordersTotal)} to="/admin/orders" />
        <Stat label="Paid orders" value={String(data.ordersPaid)} to="/admin/orders?payment=paid" />
        <Stat
          label="Waiting for you"
          value={String(waiting)}
          to="/admin/orders?status=processing&payment=paid"
          hint="Paid orders to confirm"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Orders by status</h2>
          <ul className="space-y-3">
            {ORDER_STATUSES.map((status) => {
              const count = data.ordersByStatus[status];
              return (
                <li key={status}>
                  <Link
                    to={`/admin/orders?status=${status}`}
                    className="group block"
                    aria-label={`${ORDER_STATUS_LABELS[status].label}: ${count} orders`}
                  >
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{ORDER_STATUS_LABELS[status].label}</span>
                      <span className="tabular-nums text-zinc-500">{count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-accent transition-all group-hover:bg-accent-hover"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Most bought</h2>
          {data.topProducts.length === 0 ? (
            <p className="text-sm text-zinc-500">Nothing sold yet.</p>
          ) : (
            <ol className="space-y-3">
              {data.topProducts.map((product, index) => (
                <li key={product.id} className="flex items-center gap-3">
                  <span className="w-4 text-center text-sm font-semibold text-accent tabular-nums">
                    {index + 1}
                  </span>
                  <img src={product.imageUrl} alt="" className="size-10 rounded object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{product.name}</span>
                  <span className="text-sm text-zinc-500 tabular-nums">
                    {product.totalBought} sold
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </Container>
  );
}
