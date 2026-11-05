import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, PackageCheck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  LOGISTICS_STATUSES,
  nextLogisticsStatus,
  ORDER_STATUS_LABELS,
  shortOrderId,
  WEIGHT_LABELS,
  type LogisticsStatus,
  type OrderDTO,
} from '@cart2heavy/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { CompactSelect } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { api, errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { formatDate } from '../../lib/utils';
import { StatusBadge } from '../orders/badges';

type Filter = 'open' | LogisticsStatus;

/** What the button says for the step it moves the order to. */
const ACTION_LABEL: Record<LogisticsStatus, string> = {
  confirmed: 'Confirmed',
  received: 'Mark as received',
  shipping: 'Start shipping',
  shipped: 'Mark as shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Mark as delivered',
};

function OrderCard({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const next = nextLogisticsStatus(order.status);
  const { address } = order;

  const move = useMutation({
    mutationFn: (status: LogisticsStatus) =>
      api.patch<OrderDTO>(`/logistics/orders/${order.id}/status`, { status }),
    onSuccess: async (updated) => {
      toast.success(`${shortOrderId(order.id)} → ${ORDER_STATUS_LABELS[updated.status].label}`);
      await queryClient.invalidateQueries({ queryKey: ['logistics'] });
    },
    onError: async (e) => {
      toast.error(errorMessage(e));
      await queryClient.invalidateQueries({ queryKey: ['logistics'] }); // someone else may have moved it
    },
  });

  return (
    <Card className="flex flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{shortOrderId(order.id)}</p>
          <p className="text-xs text-zinc-500">Placed {formatDate(order.createdAt)}</p>
        </div>
        <div className="flex gap-1.5">
          <Badge tone="neutral" title={WEIGHT_LABELS[order.packageSize].hint}>
            Size {WEIGHT_LABELS[order.packageSize].code} · {WEIGHT_LABELS[order.packageSize].label}
          </Badge>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {order.items.map((item) => (
          <li key={item.productId} className="flex gap-2">
            <img src={item.imageUrl} alt="" className="size-8 shrink-0 rounded object-cover" />
            <span className="min-w-0 flex-1 truncate self-center">
              {item.quantity} × {item.name}
            </span>
            <span className="self-center text-xs text-zinc-500">
              {WEIGHT_LABELS[item.weight].code}
            </span>
          </li>
        ))}
      </ul>

      <address className="mt-3 rounded-md bg-zinc-50 p-3 text-sm leading-5 not-italic text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300">
        <span className="font-medium">{address.fullName}</span>
        <br />
        {address.line1}
        {address.line2 && `, ${address.line2}`}
        <br />
        {address.postalCode} {address.city}, {address.country}
        <br />
        {address.phone}
      </address>

      <div className="mt-4 flex justify-end">
        {next ? (
          <Button loading={move.isPending} onClick={() => move.mutate(next)}>
            {ACTION_LABEL[next]} <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <PackageCheck className="size-4" aria-hidden /> Delivered
          </span>
        )}
      </div>
    </Card>
  );
}

export function LogisticsPage() {
  useDocumentTitle('Logistics');
  const [filter, setFilter] = useState<Filter>('open');
  const orders = useQuery({
    queryKey: ['logistics', 'orders', filter],
    queryFn: () =>
      api.get<OrderDTO[]>('/logistics/orders', { status: filter === 'open' ? undefined : filter }),
    refetchInterval: 30_000, // new confirmed orders show up on their own
  });

  return (
    <Container>
      <PageHeader
        title="Queue"
        description="Paid orders that were confirmed by the admin, oldest first."
        actions={
          <CompactSelect
            label="Filter by status"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
          >
            <option value="open">To ship (all open)</option>
            {LOGISTICS_STATUSES.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s].label}
              </option>
            ))}
          </CompactSelect>
        }
      />

      {orders.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : orders.error ? (
        <ErrorState message={errorMessage(orders.error)} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? (
        <EmptyState icon={PackageCheck} title="Nothing here">
          {filter === 'open' ? 'All confirmed orders are on their way.' : 'No orders in this step.'}
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {orders.data.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </Container>
  );
}
