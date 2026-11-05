import { canAdminCancel, ORDER_STATUSES } from '@cart2heavy/shared';
import type {
  AdminOrdersQuery,
  AdminStatsDTO,
  OrderDTO,
  OrderStatus,
  Paginated,
  adminOrdersQuerySchema,
} from '@cart2heavy/shared';
import type { QueryFilter } from 'mongoose';
import type { z } from 'zod';
import type { AppContext } from '../../context';
import { productImageUrl, type WithId } from '../../dto';
import { Order, Product, type OrderDoc } from '../../models';
import { explainFailedTransition, transitionOrder } from '../orders/service';
import { presentOrders } from '../orders/presenter';

type ParsedQuery = z.output<typeof adminOrdersQuerySchema>;
export type { AdminOrdersQuery };

export async function listOrders(query: ParsedQuery): Promise<Paginated<OrderDTO>> {
  const filter: QueryFilter<OrderDoc> = {};
  if (query.status) filter.status = query.status;
  if (query.payment) filter['payment.status'] = query.payment;

  const [total, orders] = await Promise.all([
    Order.countDocuments(filter),
    Order.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .populate<{ user: WithId<{ name: string; email: string }> }>('user', 'name email')
      .lean(),
  ]);
  return {
    items: await presentOrders(orders, { staffNames: true }),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  };
}

/** Only an order that is paid and still "processing" can be confirmed. */
export async function confirmOrder(ctx: AppContext, adminId: string, orderId: string) {
  const order = await transitionOrder(ctx, {
    orderId,
    from: ['processing'],
    to: 'confirmed',
    actorId: adminId,
    extra: { 'payment.status': 'paid' },
  });
  return order ?? explainFailedTransition(orderId, 'Only paid orders that are still processing can be confirmed');
}

export async function cancelOrder(ctx: AppContext, adminId: string, orderId: string) {
  const allowedFrom = (['processing', 'confirmed'] as const).filter((status) => canAdminCancel({ status }));
  const order = await transitionOrder(ctx, { orderId, from: [...allowedFrom], to: 'cancelled', actorId: adminId });
  if (!order) return explainFailedTransition(orderId, 'This order can no longer be cancelled');

  // a cancelled sale no longer counts as "bought" (there is no automatic refund)
  if (order.payment.status === 'paid') {
    await Product.bulkWrite(
      order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.productId, totalBought: { $gte: item.quantity } },
          update: { $inc: { totalBought: -item.quantity } },
        },
      })),
    );
  }
  return order;
}

export async function getStats(): Promise<AdminStatsDTO> {
  const [byStatus, revenue, ordersPaid, awaitingConfirmation, top] = await Promise.all([
    Order.aggregate<{ _id: OrderStatus; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Order.aggregate<{ revenue: number }>([
      { $match: { 'payment.status': 'paid', status: { $ne: 'cancelled' } } },
      { $group: { _id: null, revenue: { $sum: '$totalCents' } } },
    ]),
    Order.countDocuments({ 'payment.status': 'paid' }),
    Order.countDocuments({ 'payment.status': 'paid', status: 'processing' }),
    Product.find({ totalBought: { $gt: 0 } })
      .sort({ totalBought: -1, name: 1 })
      .limit(5)
      .select('name image totalBought')
      .lean(),
  ]);

  const ordersByStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const row of byStatus) ordersByStatus[row._id] = row.count;

  return {
    revenueCents: revenue[0]?.revenue ?? 0,
    ordersTotal: Object.values(ordersByStatus).reduce((a, b) => a + b, 0),
    ordersPaid,
    awaitingConfirmation,
    ordersByStatus,
    topProducts: top.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      imageUrl: productImageUrl(p.image),
      totalBought: p.totalBought,
    })),
  };
}
