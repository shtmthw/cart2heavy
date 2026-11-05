import type { OrderDTO } from '@cart2heavy/shared';
import { toOrderDTO, type OrderWithCustomer } from '../../dto';
import { User } from '../../models';

/**
 * Turns orders into DTOs. Staff names in the status history are only looked up for the
 * admin / logistics views – customers just see the steps.
 */
export async function presentOrders(
  orders: OrderWithCustomer[],
  { staffNames }: { staffNames: boolean },
): Promise<OrderDTO[]> {
  let names = new Map<string, string>();
  if (staffNames) {
    const ids = new Set<string>();
    for (const order of orders) {
      for (const event of order.statusHistory) if (event.by) ids.add(event.by.toString());
    }
    if (ids.size > 0) {
      const users = await User.find({ _id: { $in: [...ids] } })
        .select('name')
        .lean();
      names = new Map(users.map((u) => [u._id.toString(), u.name]));
    }
  }
  return orders.map((order) => toOrderDTO(order, names));
}
