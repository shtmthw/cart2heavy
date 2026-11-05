import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../../lib/hooks';
import { cn } from '../../lib/utils';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A pill button that opens a list of choices (sorting, filters). On wider screens the list drops
 * down under the button; on phones it slides up from the bottom as a sheet, in thumb reach.
 * Keyboard: Enter / Space / arrows open it, arrows move, Enter picks, Esc or Tab closes.
 */
export function Dropdown<T extends string>({
  label,
  prefix,
  icon: Icon,
  value,
  options,
  onChange,
  align = 'end',
  className,
}: {
  /** what the control is for, e.g. "Sort products" (read out by screen readers, title of the sheet) */
  label: string;
  /** a short muted word in front of the value, e.g. "Sort" */
  prefix?: string;
  icon?: LucideIcon;
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  align?: 'start' | 'end';
  className?: string;
}) {
  const id = useId();
  const isPhone = useMediaQuery('(max-width: 639px)');
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const current = options[selectedIndex];

  const openList = () => {
    setActive(selectedIndex);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  const choose = (index: number) => {
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
    close();
  };

  // focus the list when it opens; close on a click outside
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  // the sheet covers the page: keep the page behind it from scrolling
  useEffect(() => {
    if (!open || !isPhone) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open, isPhone]);

  // keep the highlighted option in view
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      openList();
    }
  };
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = options.length - 1;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => (i >= last ? 0 : i + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (i <= 0 ? last : i - 1));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(last);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const list = (
    <ul
      ref={listRef}
      id={`${id}-list`}
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-activedescendant={`${id}-${active}`}
      onKeyDown={onListKeyDown}
      className={cn('outline-none', isPhone ? 'space-y-0.5' : 'max-h-80 overflow-y-auto p-1')}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <li
            key={option.value}
            id={`${id}-${index}`}
            role="option"
            aria-selected={selected}
            onPointerEnter={() => setActive(index)}
            onClick={() => choose(index)}
            className={cn(
              'flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 text-zinc-300 transition-colors select-none',
              isPhone ? 'h-12 text-base' : 'h-9 text-sm',
              index === active && 'bg-zinc-800 text-zinc-100',
              selected && 'font-medium text-accent',
            )}
          >
            <span className="truncate">{option.label}</span>
            {selected && <Check className="size-4 shrink-0" aria-hidden />}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={rootRef} className={cn('relative inline-flex', className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`${label}: ${current?.label ?? ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onButtonKeyDown}
        className={cn(
          'inline-flex h-10 max-w-full items-center gap-2 rounded-full border bg-zinc-900 pr-3 pl-3.5 text-sm transition-colors',
          open
            ? 'border-zinc-600 text-zinc-100'
            : 'border-zinc-800 text-zinc-200 hover:border-zinc-700 hover:text-zinc-100',
        )}
      >
        {Icon && <Icon className="size-4 shrink-0 text-zinc-500" aria-hidden />}
        {prefix && <span className="text-zinc-500">{prefix}</span>}
        <span className="truncate font-medium">{current?.label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 shrink-0 text-zinc-500 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && !isPhone && (
        <div
          className={cn(
            'animate-pop absolute top-full z-30 mt-2 w-max max-w-[calc(100vw-2rem)] min-w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/40',
            align === 'end' ? 'right-0 origin-top-right' : 'left-0 origin-top-left',
          )}
        >
          <div className="min-w-48">{list}</div>
        </div>
      )}

      {open &&
        isPhone &&
        // rendered into <body> so page animations (transforms) cannot break `fixed`
        createPortal(
          <div className="fixed inset-0 z-40 flex flex-col justify-end">
            <div
              aria-hidden
              className="animate-fade-in absolute inset-0 bg-black/60"
              onClick={() => close()}
            />
            <div
              ref={panelRef}
              className="animate-sheet relative rounded-t-2xl border-t border-zinc-800 bg-zinc-900 px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
            >
              <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-zinc-700" />
              <p className="px-3 pb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
                {label}
              </p>
              {list}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
