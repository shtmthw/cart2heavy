import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  canAdminCancel,
  canAdminConfirm,
  formatCents,
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  shortOrderId,
  WEIGHT_LABELS,
  type OrderDTO,
} from '@cart2heavy/shared';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog } from '../../components/ui/dialog';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { CompactSelect } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';
import { Table, Td, Th } from '../../components/ui/table';
import { api, errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { formatDate, formatDateTime } from '../../lib/utils';
import { useState } from 'react';
import { PaymentBadge, StatusBadge } from '../orders/badges';
import { OrderTimeline } from '../orders/OrderTimeline';
import { adminOrdersQuery } from './queries';

function OrderDetails({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const [cancelling, setCancelling] = useState(false);

  const act = useMutation({
    mutationFn: (action: 'confirm' | 'cancel') => api.post<OrderDTO>(`/admin/orders/${order.id}/${action}`),
    onSuccess: async (_updated, action) => {
      toast.success(action === 'confirm' ? 'Order confirmed' : 'Order cancelled');
      setCancelling(false);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setCancelling(false);
    },
  });

  const confirmable = canAdminConfirm({ status: order.status, paymentStatus: order.payment.status });
  const cancellable = canAdminCancel({ status: order.status });
  const { address } = order;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-500">Placed {formatDateTime(order.createdAt)}</p>
        <div className="flex gap-1.5">
          <StatusBadge status={order.status} />
          <PaymentBadge status={order.payment.status} />
        </div>
      </div>

      {(confirmable || cancellable) && (
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-md bg-zinc-50 p-3 dark:bg-zinc-800/60">
          {cancellable && (
            <Button variant="secondary" onClick={() => setCancelling(true)}>
              Cancel order
            </Button>
          )}
          {confirmable && (
            <Button loading={act.isPending && act.variables === 'confirm'} onClick={() => act.mutate('confirm')}>
              Confirm order
            </Button>
          )}
          {!confirmable && order.status === 'processing' && (
            <p className="mr-auto text-xs text-zinc-500">Waiting for the payment before it can be confirmed.</p>
          )}
        </div>
      )}


      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <h3 className="mb-1 font-semibold">Customer</h3>
          <p>{order.customer?.name}</p>
          <p className="text-zinc-500">{order.email}</p>
        </div>
        <div>
          <h3 className="mb-1 font-semibold">Delivery address</h3>
          <address className="not-italic leading-5 text-zinc-700 dark:text-zinc-300">
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
            {address.postalCode} {address.city}, {address.country}
            <br />
            {address.phone}
          </address>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Items · package size {WEIGHT_LABELS[order.packageSize].code} ({WEIGHT_LABELS[order.packageSize].label})
        </h3>
        <ul className="divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-3 py-2">
              <img src={item.imageUrl} alt="" className="size-9 rounded object-cover" />
              <span className="min-w-0 flex-1 truncate">
                {item.quantity} × {item.name}
              </span>
              <span className="tabular-nums">{formatCents(item.lineTotalCents)}</span>
            </li>
          ))}
          <li className="flex justify-between py-2 text-zinc-500">
            <span>Delivery</span>
            <span className="tabular-nums">{formatCents(order.deliveryCents)}</span>
          </li>
          <li className="flex justify-between py-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(order.totalCents)}</span>
          </li>
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">History</h3>
        <OrderTimeline order={order} compact />
      </div>

      <ConfirmDialog
        open={cancelling}
        title={`Cancel order ${shortOrderId(order.id)}`}
        confirmLabel="Cancel order"
        loading={act.isPending}
        onClose={() => setCancelling(false)}
        onConfirm={() => act.mutate('cancel')}
      >
        The customer gets an email. {order.payment.status === 'paid' ? 'The order is paid – refund it yourself in your payment dashboard.' : ''}
      </ConfirmDialog>
    </div>
  );
}

export function OrdersPage() {
  useDocumentTitle('Orders');
  const [params, setParams] = useSearchParams();
  const status = ORDER_STATUSES.find((s) => s === params.get('status'));
  const payment = PAYMENT_STATUSES.find((s) => s === params.get('payment'));
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const orders = useQuery(adminOrdersQuery({ status, payment, page, limit: 10 }));
  const selected = orders.data?.items.find((o) => o.id === selectedId) ?? null;

  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next);
  };

  return (
    <Container>
      <PageHeader
        title="Orders"
        actions={
          <div className="flex flex-wrap gap-2">
            <CompactSelect
              label="Filter by status"
              value={status ?? ''}
              onChange={(e) => update({ status: e.target.value, page: undefined })}
            >
              <option value="">All statuses</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s].label}
                </option>
              ))}
            </CompactSelect>
            <CompactSelect
              label="Filter by payment"
              value={payment ?? ''}
              onChange={(e) => update({ payment: e.target.value, page: undefined })}
            >
              <option value="">Any payment</option>
              <option value="paid">Paid</option>
              <option value="pending">Awaiting payment</option>
              <option value="failed">Payment failed</option>
            </CompactSelect>
          </div>
        }
      />

      {orders.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : orders.error ? (
        <ErrorState message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} />
      ) : orders.data.items.length === 0 ? (
        <EmptyState title="No orders match these filters" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Order</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th>Status</Th>
                <Th>Payment</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {orders.data.items.map((order) => (
                <tr key={order.id}>
                  <Td>
                    <p className="font-medium">{shortOrderId(order.id)}</p>
                    <p className="text-xs text-zinc-500">{formatDate(order.createdAt)}</p>
                  </Td>
                  <Td>
                    <p>{order.customer?.name}</p>
                    <p className="text-xs text-zinc-500">{order.email}</p>
                  </Td>
                  <Td className="text-right tabular-nums">{formatCents(order.totalCents)}</Td>
                  <Td>
                    <StatusBadge status={order.status} />
                  </Td>
                  <Td>
                    <PaymentBadge status={order.payment.status} />
                  </Td>
                  <Td className="text-right">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Open order ${shortOrderId(order.id)}`}
                      onClick={() => setSelectedId(order.id)}
                    >
                      Open
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={orders.data.page}
            totalPages={orders.data.totalPages}
            onPageChange={(next) => update({ page: next === 1 ? undefined : String(next) })}
          />
        </>
      )}

      <Dialog
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `Order ${shortOrderId(selected.id)}` : 'Order'}
      >
        {selected && <OrderDetails order={selected} />}
      </Dialog>
    </Container>
  );
}
