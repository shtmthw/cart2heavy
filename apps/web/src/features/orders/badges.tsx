import type { OrderStatus, PaymentStatus } from '@cart2heavy/shared';
import { ORDER_STATUS_LABELS } from '@cart2heavy/shared';
import { Badge, type Tone } from '../../components/ui/badge';

const STATUS_TONE: Record<OrderStatus, Tone> = {
  processing: 'warning',
  confirmed: 'accent',
  received: 'accent',
  shipping: 'accent',
  shipped: 'accent',
  out_for_delivery: 'accent',
  delivered: 'success',
  cancelled: 'danger',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS_LABELS[status].label}</Badge>;
}

const PAYMENT: Record<PaymentStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'success' },
  pending: { label: 'Awaiting payment', tone: 'warning' },
  failed: { label: 'Payment failed', tone: 'danger' },
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  const { label, tone } = PAYMENT[status];
  return <Badge tone={tone}>{label}</Badge>;
}
