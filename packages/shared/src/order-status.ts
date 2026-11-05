import type { OrderStatus, PaymentStatus } from './constants';

export const ORDER_STATUS_LABELS: Record<OrderStatus, { label: string; description: string }> = {
  processing: { label: 'Processing', description: 'We received your order and are checking it.' },
  confirmed: { label: 'Confirmed', description: 'Your order has been confirmed.' },
  received: { label: 'Received by logistics', description: 'The logistics team has your package.' },
  shipping: { label: 'Being shipped', description: 'Your package is being prepared for shipping.' },
  shipped: { label: 'Shipped', description: 'Your package has left our warehouse.' },
  out_for_delivery: {
    label: 'Out for delivery',
    description: 'Your package is on its way to you.',
  },
  delivered: { label: 'Delivered', description: 'Your package has been delivered.' },
  cancelled: { label: 'Cancelled', description: 'This order was cancelled.' },
};

/** The steps the logistics team moves an order through (it starts at "confirmed"). */
export const LOGISTICS_STATUSES = [
  'confirmed',
  'received',
  'shipping',
  'shipped',
  'out_for_delivery',
  'delivered',
] as const satisfies readonly OrderStatus[];
export type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];

/** All steps of the happy path, in order, as shown in the customer's timeline. */
export const TIMELINE_STATUSES = ['processing', ...LOGISTICS_STATUSES] as const;

export function isLogisticsStatus(status: string): status is LogisticsStatus {
  return (LOGISTICS_STATUSES as readonly string[]).includes(status);
}

/** The next logistics step after `status`, or null when there is none. */
export function nextLogisticsStatus(status: OrderStatus): LogisticsStatus | null {
  if (!isLogisticsStatus(status)) return null;
  return LOGISTICS_STATUSES[LOGISTICS_STATUSES.indexOf(status) + 1] ?? null;
}

/** Logistics can only move an order forward along its steps – never back, never sideways. */
export function canLogisticsMove(from: OrderStatus, to: OrderStatus): boolean {
  if (!isLogisticsStatus(from) || !isLogisticsStatus(to)) return false;
  return LOGISTICS_STATUSES.indexOf(to) > LOGISTICS_STATUSES.indexOf(from);
}

/** Admin confirms an order once it is paid and still waiting in "processing". */
export function canAdminConfirm(order: { status: OrderStatus; paymentStatus: PaymentStatus }) {
  return order.status === 'processing' && order.paymentStatus === 'paid';
}

/** An order can be cancelled until the logistics team has received it. */
export function canAdminCancel(order: { status: OrderStatus }) {
  return order.status === 'processing' || order.status === 'confirmed';
}
