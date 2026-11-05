import { Minus, Plus } from 'lucide-react';
import { LIMITS } from '@cart2heavy/shared';
import { cn } from '../../lib/utils';

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = LIMITS.maxCartQuantity,
  disabled,
  label = 'Quantity',
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  const button =
    'grid size-11 place-items-center sm:size-9 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-transparent dark:text-zinc-300 dark:hover:bg-zinc-800';
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex items-center rounded-md border border-zinc-300 dark:border-zinc-700',
        className,
      )}
    >
      <button
        type="button"
        className={cn(button, 'rounded-l-md')}
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className="min-w-10 px-1 text-center text-base tabular-nums sm:text-sm"
      >
        {value}
      </output>
      <button
        type="button"
        className={cn(button, 'rounded-r-md')}
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
