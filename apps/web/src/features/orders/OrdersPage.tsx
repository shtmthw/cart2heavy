import { useQuery } from '@tanstack/react-query';
import { PackageOpen } from 'lucide-react';
import { Link } from 'react-router';
import { formatCents, shortOrderId } from '@cart2heavy/shared';
import { ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { Container, PageHeader } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { myOrdersQuery } from '../../lib/queries';
import { formatDate, pluralize } from '../../lib/utils';
import { PaymentBadge, StatusBadge } from './badges';

export function OrdersPage() {
  useDocumentTitle('My orders');
  const { data: orders, isPending, error, refetch } = useQuery(myOrdersQuery);

  return (
    <Container className="max-w-3xl">
      <PageHeader title="My orders" />
      {isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={PackageOpen}
          title="No orders yet"
          action={<ButtonLink to="/">Browse products</ButtonLink>}
        >
          When you buy something, you can follow it here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link to={`/orders/${order.id}`} className="block">
                <Card className="p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">Order {shortOrderId(order.id)}</p>
                      <p className="text-xs text-zinc-500">{formatDate(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <StatusBadge status={order.status} />
                      <PaymentBadge status={order.payment.status} />
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex -space-x-2">
                      {order.items.slice(0, 4).map((item) => (
                        <img
                          key={item.productId}
                          src={item.imageUrl}
                          alt=""
                          className="size-10 rounded-full border-2 border-white object-cover dark:border-zinc-900"
                        />
                      ))}
                    </div>
                    <p className="text-sm text-zinc-500">
                      {pluralize(
                        order.items.reduce((n, i) => n + i.quantity, 0),
                        'item',
                      )}{' '}
                      ·{' '}
                      <span className="font-semibold text-zinc-900 tabular-nums dark:text-zinc-100">
                        {formatCents(order.totalCents)}
                      </span>
                    </p>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
