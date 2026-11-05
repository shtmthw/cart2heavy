import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

/** A horizontally scrollable table (so it also works on a phone). */
export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  );
}

export function Th({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs font-medium whitespace-nowrap text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'border-b border-zinc-100 px-4 py-3 align-middle dark:border-zinc-800/70',
        className,
      )}
      {...props}
    />
  );
}
