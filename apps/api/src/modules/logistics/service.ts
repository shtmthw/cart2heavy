import {
  canLogisticsMove,
  LOGISTICS_STATUSES,
  type LogisticsStatus,
  type OrderDTO,
} from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import type { WithId } from '../../dto';
import { HttpError } from '../../errors';
import { Order } from '../../models';
import { presentOrders } from '../orders/presenter';
import { explainFailedTransition, transitionOrder } from '../orders/service';

/**
 * The warehouse queue: paid orders the admin has confirmed. Without a filter it shows what still
 * has to be shipped; ask for `delivered` to see the finished ones.
 */
export async function listQueue(status?: LogisticsStatus): Promise<OrderDTO[]> {
  const statuses = status ? [status] : LOGISTICS_STATUSES.filter((s) => s !== 'delivered');
  const orders = await Order.find({ status: { $in: statuses }, 'payment.status': 'paid' })
    .sort({ createdAt: 1, _id: 1 }) // oldest first
    .limit(200)
    .populate<{ user: WithId<{ name: string; email: string }> }>('user', 'name email')
    .lean();
  return presentOrders(orders, { staffNames: true });
}

/** Moves an order forward along the shipping steps – never backwards. */
export async function moveOrder(
  ctx: AppContext,
  staffId: string,
  orderId: string,
  to: LogisticsStatus,
): Promise<OrderDTO> {
  const current = await Order.findOne({ _id: orderId, 'payment.status': 'paid' }).select('status').lean();
  if (!current) throw HttpError.notFound('Order');
  if (!canLogisticsMove(current.status, to)) {
    throw HttpError.conflict(`An order that is "${current.status}" cannot be moved to "${to}"`);
  }
  const order = await transitionOrder(ctx, {
    orderId,
    from: [current.status], // someone else moved it in the meantime -> no match
    to,
    actorId: staffId,
    extra: { 'payment.status': 'paid' },
  });
  return order ?? explainFailedTransition(orderId, 'This order was just updated by someone else. Refresh and try again.');
}
