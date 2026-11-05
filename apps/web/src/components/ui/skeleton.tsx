import { Loader2 } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800', className)}
      {...props}
    />
  );
}

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <Loader2 className={cn('size-5 animate-spin text-zinc-400', className)} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}
