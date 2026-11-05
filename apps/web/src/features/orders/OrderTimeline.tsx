import { Check, Circle, X } from 'lucide-react';
import { ORDER_STATUS_LABELS, TIMELINE_STATUSES, type OrderDTO } from '@cart2heavy/shared';
import { cn, formatDateTime } from '../../lib/utils';

/** processing → confirmed → … → delivered, with the time of every step that happened. */
export function OrderTimeline({ order }: { order: Pick<OrderDTO, 'status' | 'statusHistory'> }) {
  const at = new Map(order.statusHistory.map((event) => [event.status, event.at]));

  if (order.status === 'cancelled') {
    return (
      <ol className="space-y-4">
        {order.statusHistory.map((event) => (
          <li key={event.status} className="flex gap-3">
            {event.status === 'cancelled' ? (
              <X className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
            ) : (
              <Check className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
            )}
            <div>
              <p className="text-sm font-medium">{ORDER_STATUS_LABELS[event.status].label}</p>
              <p className="text-xs text-zinc-500">{formatDateTime(event.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  const currentIndex = TIMELINE_STATUSES.indexOf(order.status);
  return (
    <ol aria-label="Order progress">
      {TIMELINE_STATUSES.map((status, index) => {
        const done = index < currentIndex || (index === currentIndex && status === 'delivered');
        const current = index === currentIndex;
        const time = at.get(status);
        const last = index === TIMELINE_STATUSES.length - 1;
        return (
          <li
            key={status}
            aria-current={current ? 'step' : undefined}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-6 bottom-0 left-2.5 w-px -translate-x-1/2',
                  index < currentIndex ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-800',
                )}
              />
            )}
            <span
              aria-hidden
              className={cn(
                'relative z-10 mt-0.5 grid size-5 shrink-0 place-items-center rounded-full',
                done && 'bg-emerald-600 text-white',
                current &&
                  !done &&
                  'bg-accent text-white ring-4 ring-accent-soft dark:ring-indigo-950',
                !done && !current && 'bg-white text-zinc-300 dark:bg-zinc-950 dark:text-zinc-700',
              )}
            >
              {done ? (
                <Check className="size-3" />
              ) : (
                <Circle className={cn('size-3', current && 'fill-current')} />
              )}
            </span>
            <div className={cn(!done && !current && 'text-zinc-400 dark:text-zinc-600')}>
              <p className={cn('text-sm', (current || done) && 'font-medium')}>
                {ORDER_STATUS_LABELS[status].label}
                {current && <span className="sr-only"> (current step)</span>}
              </p>
              {time ? (
                <p className="text-xs text-zinc-500">{formatDateTime(time)}</p>
              ) : current ? (
                <p className="text-xs text-zinc-500">{ORDER_STATUS_LABELS[status].description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
