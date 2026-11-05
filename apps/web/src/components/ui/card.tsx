import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none',
        className,
      )}
      {...props}
    />
  );
}
