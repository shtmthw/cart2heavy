import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16 text-center">
      {Icon && <Icon className="mb-3 size-8 text-zinc-400" aria-hidden />}
      <h2 className="text-base font-semibold">{title}</h2>
      {children && (
        <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{children}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-16 text-center">
      <h2 className="text-base font-semibold">Something went wrong</h2>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Try again
        </button>
      )}
    </div>
  );
}
