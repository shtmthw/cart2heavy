import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { formatCents, shortOrderId, type CheckoutResultDTO } from '@cart2heavy/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { Container } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { orderQuery } from '../../lib/queries';
import { formatDateTime } from '../../lib/utils';
import { followUrl } from '../../lib/redirect';
import { PaymentBadge, StatusBadge } from './badges';
import { OrderTimeline } from './OrderTimeline';

export function OrderDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: order, isPending, error, refetch } = useQuery(orderQuery(id));
  useDocumentTitle(order ? `Order ${shortOrderId(order.id)}` : 'Order');

  const pay = useMutation({
    mutationFn: () => api.post<CheckoutResultDTO>(`/orders/${id}/pay`),
    onSuccess: ({ redirectUrl }) => followUrl(redirectUrl, navigate),
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (isPending) {
    return (
      <Container className="max-w-4xl space-y-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }
  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return (
        <Container>
          <EmptyState
            title="Order not found"
            action={
              <Link to="/orders" className="text-accent hover:underline">
                My orders
              </Link>
            }
          >
            This order does not exist or belongs to another account.
          </EmptyState>
        </Container>
      );
    }
    return (
      <Container>
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      </Container>
    );
  }

  const unpaid = order.payment.status !== 'paid' && order.status !== 'cancelled';
  const { address } = order;
  return (
    <Container className="max-w-4xl">
      <Link
        to="/orders"
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" aria-hidden /> My orders
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Order {shortOrderId(order.id)}</h1>
          <p className="text-sm text-zinc-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex gap-1.5">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.payment.status} />
        </div>
      </div>

      {unpaid && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <p className="text-sm">This order is waiting for payment.</p>
          <Button loading={pay.isPending} onClick={() => pay.mutate()}>
            Pay {formatCents(order.totalCents)}
          </Button>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-semibold">Progress</h2>
            <OrderTimeline order={order} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Items</h2>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {order.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/products/${item.productId}`}
                      className="line-clamp-2 text-sm font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-zinc-500 tabular-nums">
                      {item.quantity} × {formatCents(item.priceCents)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCents(item.lineTotalCents)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Total</h2>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="tabular-nums">{formatCents(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Delivery</dt>
                <dd className="tabular-nums">{formatCents(order.deliveryCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCents(order.totalCents)}</dd>
              </div>
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Delivery address</h2>
            <address className="text-sm leading-6 not-italic text-zinc-700 dark:text-zinc-300">
              {address.fullName}
              <br />
              {address.line1}
              {address.line2 && (
                <>
                  <br />
                  {address.line2}
                </>
              )}
              <br />
              {address.postalCode} {address.city}
              <br />
              {address.country}
              <br />
              {address.phone}
            </address>
          </Card>
        </div>
      </div>
    </Container>
  );
}
