import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '../../lib/utils';

const control =
  'block w-full rounded-lg border bg-white px-3 text-base text-zinc-900 sm:text-sm placeholder:text-zinc-400 transition-shadow ' +
  'border-zinc-200 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 ' +
  'disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800 dark:hover:border-zinc-700 dark:placeholder:text-zinc-500';

interface FieldShellProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  className?: string | undefined;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** Label + control + error/hint, wired together for screen readers. */
function FieldShell({ label, error, hint, className, children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-message`;
  const describedBy = error || hint ? messageId : undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, describedBy, invalid: !!error })}
      {(error || hint) && (
        <p
          id={messageId}
          role={error ? 'alert' : undefined}
          className={cn(
            'text-xs',
            error ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400',
          )}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

interface CommonProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  wrapperClassName?: string;
}

export function TextField({
  label,
  error,
  hint,
  wrapperClassName,
  className,
  ...props
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'h-11 sm:h-10', invalid && 'border-red-500', className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextArea({
  label,
  error,
  hint,
  wrapperClassName,
  className,
  ...props
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'min-h-28 py-2.5', invalid && 'border-red-500', className)}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  wrapperClassName,
  className,
  children,
  ...props
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} error={error} hint={hint} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <select
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(control, 'h-11 sm:h-10', invalid && 'border-red-500', className)}
          {...props}
        >
          {children}
        </select>
      )}
    </FieldShell>
  );
}
