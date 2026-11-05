import type { Types } from 'mongoose';
import {
  formatCents,
  type CheckoutInput,
  type CheckoutResultDTO,
  type OrderDTO,
  type OrderStatus,
} from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import type { WithId } from '../../dto';
import { HttpError } from '../../errors';
import { orderReceivedEmail, orderStatusEmail, type StatusEmailKind } from '../../mail/templates';
import { sendInBackground } from '../../mail/mailer';
import type { AuthUser } from '../../middleware/auth';
import { Order, Product, User, type CategoryDoc, type OrderDoc } from '../../models';
import { priceCart } from '@cart2heavy/shared';
import { presentOrders } from './presenter';

type LeanOrder = WithId<OrderDoc>;

/* ---------------------------------------------------------------- reading */

export async function listMyOrders(userId: string): Promise<OrderDTO[]> {
  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .lean();
  return presentOrders(orders, { staffNames: false });
}

async function findOwnedOrder(userId: string, orderId: string): Promise<LeanOrder> {
  // another user's order looks exactly like a missing one
  const order = await Order.findOne({ _id: orderId, user: userId }).lean();
  if (!order) throw HttpError.notFound('Order');
  return order;
}

export async function getMyOrder(userId: string, orderId: string): Promise<OrderDTO> {
  const order = await findOwnedOrder(userId, orderId);
  const [dto] = await presentOrders([order], { staffNames: false });
  return dto!;
}

/* --------------------------------------------------------------- checkout */

/** Asks the payment provider for a checkout page for this order and remembers the session. */
async function startPayment(ctx: AppContext, order: LeanOrder): Promise<CheckoutResultDTO> {
  const orderId = order._id.toString();
  const successUrl = `${ctx.config.appUrl}/checkout/result?orderId=${orderId}`;
  const session = await ctx.payments.createCheckout({
    orderId,
    email: order.email,
    items: order.items.map((i) => ({
      name: i.name,
      priceCents: i.priceCents,
      quantity: i.quantity,
    })),
    deliveryCents: order.deliveryCents,
    totalCents: order.totalCents,
    successUrl,
    cancelUrl: `${successUrl}&cancelled=1`,
  });
  await Order.updateOne(
    { _id: order._id },
    { $set: { 'payment.sessionId': session.sessionId, 'payment.status': 'pending' } },
  );
  return { orderId, redirectUrl: session.redirectUrl };
}

/**
 * Turns the user's server-side cart into an order. Prices, totals and the minimum order are all
 * computed here from the database – nothing about money is taken from the request.
 */
export async function checkout(
  ctx: AppContext,
  user: AuthUser,
  input: CheckoutInput,
): Promise<CheckoutResultDTO> {
  const account = await User.findById(user.id).select('cart').lean();
  if (!account) throw HttpError.unauthorized();
  if (account.cart.length === 0) throw HttpError.badRequest('Your cart is empty');

  const products = await Product.find({ _id: { $in: account.cart.map((l) => l.product) } })
    .populate<{ category: WithId<CategoryDoc> | null }>('category', 'weight')
    .lean();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  const unavailable: string[] = [];
  const items: OrderDoc['items'] = [];
  for (const line of account.cart) {
    const product = byId.get(line.product.toString());
    if (!product || !product.isActive || !product.category) {
      unavailable.push(product?.name ?? 'an item that was removed');
      continue;
    }
    items.push({
      product: product._id,
      name: product.name,
      priceCents: product.priceCents,
      quantity: line.quantity,
      weight: product.category.weight,
      image: product.image,
    });
  }
  if (unavailable.length > 0) {
    throw HttpError.conflict(
      `Some items are no longer available: ${unavailable.join(', ')}. Remove them from your cart to continue.`,
    );
  }

  const totals = priceCart(
    items.map((i) => ({ ...i, isActive: true })),
    ctx.config,
  );
  if (!totals.meetsMinimum) {
    throw new HttpError(
      400,
      'min_order',
      `The minimum order is ${formatCents(ctx.config.minOrderCents)} (before delivery).`,
    );
  }

  const order = await Order.create({
    user: user.id,
    email: user.email,
    items,
    subtotalCents: totals.subtotalCents,
    deliveryCents: totals.deliveryCents,
    totalCents: totals.totalCents,
    address: input.address,
    status: 'processing',
    statusHistory: [{ status: 'processing', at: new Date(), by: null }],
    payment: { provider: ctx.payments.name, status: 'pending', sessionId: null, paidAt: null },
  });

  try {
    // the cart is kept until the payment is confirmed
    return await startPayment(ctx, order.toObject());
  } catch (err) {
    ctx.logger.error({ err, orderId: order.id }, 'could not start the payment');
    await Order.deleteOne({ _id: order._id });
    throw new HttpError(502, 'payment_error', 'We could not start the payment. Please try again.');
  }
}

export async function retryPayment(ctx: AppContext, userId: string, orderId: string) {
  const order = await findOwnedOrder(userId, orderId);
  if (order.payment.status === 'paid') throw HttpError.conflict('This order is already paid');
  if (order.status === 'cancelled') throw HttpError.conflict('This order was cancelled');
  try {
    return await startPayment(ctx, order);
  } catch (err) {
    ctx.logger.error({ err, orderId }, 'could not restart the payment');
    throw new HttpError(502, 'payment_error', 'We could not start the payment. Please try again.');
  }
}

/* ---------------------------------------------------------------- payment */

/**
 * Records a successful payment. Safe to call any number of times (browser return, webhook, page
 * refresh): the database update only matches an order that is not paid yet, so the side effects
 * – "most bought" counters, emptying the cart, the email – happen exactly once.
 */
export async function markOrderPaid(
  ctx: AppContext,
  orderId: string | Types.ObjectId,
  sessionId?: string,
): Promise<'paid_now' | 'already_paid' | 'not_found'> {
  const order = await Order.findOneAndUpdate(
    { _id: orderId, 'payment.status': { $ne: 'paid' } },
    {
      $set: {
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
        ...(sessionId ? { 'payment.sessionId': sessionId } : {}),
      },
    },
    { returnDocument: 'after' },
  ).lean();

  if (!order) return (await Order.exists({ _id: orderId })) ? 'already_paid' : 'not_found';

  if (order.status === 'cancelled') {
    ctx.logger.warn(
      { orderId },
      'a payment arrived for a cancelled order – it needs a manual refund',
    );
  } else {
    // "most bought" counts units sold, and only after the money arrived
    await Product.bulkWrite(
      order.items.map((item) => ({
        updateOne: {
          filter: { _id: item.product },
          update: { $inc: { totalBought: item.quantity } },
        },
      })),
    );
  }
  await User.updateOne(
    { _id: order.user },
    { $pull: { cart: { product: { $in: order.items.map((i) => i.product) } } } },
  );

  const [dto] = await presentOrders([order], { staffNames: false });
  sendInBackground(ctx.mailer, ctx.logger, orderReceivedEmail(dto!, ctx.config.appUrl));
  return 'paid_now';
}

/** The customer came back from the payment page: ask the provider what really happened. */
export async function verifyOrder(
  ctx: AppContext,
  userId: string,
  orderId: string,
): Promise<OrderDTO> {
  const order = await findOwnedOrder(userId, orderId);

  if (order.payment.status !== 'paid' && order.payment.sessionId) {
    const result = await ctx.payments.getStatus(order.payment.sessionId);
    if (result.state === 'paid') {
      if (result.amountCents !== undefined && result.amountCents !== order.totalCents) {
        ctx.logger.error(
          { orderId, expected: order.totalCents, charged: result.amountCents },
          'payment amount does not match the order total',
        );
        throw new HttpError(
          502,
          'payment_error',
          'The paid amount did not match this order. Please contact us.',
        );
      }
      await markOrderPaid(ctx, order._id, order.payment.sessionId);
    } else if (result.state === 'failed' && order.payment.status === 'pending') {
      await Order.updateOne(
        { _id: order._id, 'payment.status': 'pending' },
        { $set: { 'payment.status': 'failed' } },
      );
    }
  }
  return getMyOrder(userId, orderId);
}

/* ------------------------------------------------------- status changes */

const EMAIL_FOR_STATUS: Partial<Record<OrderStatus, StatusEmailKind>> = {
  confirmed: 'confirmed',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
};

/**
 * Moves an order to a new status – only if it is still in one of the `from` statuses (and matches
 * `extra`). Returns null when the guard did not match, so two people clicking at once cannot both win.
 */
export async function transitionOrder(
  ctx: AppContext,
  options: {
    orderId: string;
    from: OrderStatus[];
    to: OrderStatus;
    actorId: string;
    extra?: Record<string, unknown>;
  },
): Promise<OrderDTO | null> {
  const order = await Order.findOneAndUpdate(
    { _id: options.orderId, status: { $in: options.from }, ...options.extra },
    {
      $set: { status: options.to },
      $push: { statusHistory: { status: options.to, at: new Date(), by: options.actorId } },
    },
    { returnDocument: 'after' },
  )
    .populate<{ user: WithId<{ name: string; email: string }> }>('user', 'name email')
    .lean();
  if (!order) return null;

  const [dto] = await presentOrders([order], { staffNames: true });
  const kind = EMAIL_FOR_STATUS[options.to];
  if (kind)
    sendInBackground(ctx.mailer, ctx.logger, orderStatusEmail(dto!, ctx.config.appUrl, kind));
  return dto!;
}

/** Throws the right error after a failed `transitionOrder`: missing order or wrong state. */
export async function explainFailedTransition(orderId: string, message: string): Promise<never> {
  if (!(await Order.exists({ _id: orderId }))) throw HttpError.notFound('Order');
  throw HttpError.conflict(message);
}
