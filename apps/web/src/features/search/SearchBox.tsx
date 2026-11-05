import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router';
import { formatCents } from '@cart2heavy/shared';
import { useDebounced } from '../../lib/hooks';
import { suggestQuery } from '../../lib/queries';
import { cn } from '../../lib/utils';

/** Header search: instant suggestions (300 ms debounce), arrow keys + Enter, Esc to close. */
export function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = useDebounced(text.trim(), 300);
  const enabled = query.length >= 2;
  const { data: suggestions = [], isFetching } = useQuery({ ...suggestQuery(query), enabled });

  // close the list when the user clicks elsewhere
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const showList = open && enabled && text.trim() === query;
  const options = suggestions;

  const goToResults = () => {
    const q = text.trim();
    if (!q) return;
    setOpen(false);
    void navigate(`/search?q=${encodeURIComponent(q)}`);
  };
  const goToProduct = (id: string) => {
    setOpen(false);
    void navigate(`/products/${id}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (options.length ? (i + 1) % options.length : -1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => (options.length ? (i <= 0 ? options.length - 1 : i - 1) : -1));
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = showList ? options[active] : undefined;
      if (chosen) goToProduct(chosen.id);
      else goToResults();
    }
  };

  return (
    <div ref={rootRef} className={cn('relative', className)} role="search">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-400"
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-label="Search products"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder="Search products"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-11 w-full rounded-full border border-zinc-200 bg-white pr-4 pl-10 text-sm shadow-sm transition-all placeholder:text-zinc-400 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15 dark:border-zinc-700 dark:bg-zinc-900"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!showList}
        className="animate-pop absolute top-full right-0 left-0 z-30 mt-2 origin-top overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        {options.map((product, index) => (
          <li
            key={product.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            onPointerEnter={() => setActive(index)}
            onClick={() => goToProduct(product.id)}
            className={cn(
              'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm',
              index === active && 'bg-zinc-100 dark:bg-zinc-800',
            )}
          >
            <img src={product.imageUrl} alt="" className="size-9 shrink-0 rounded object-cover" />
            <span className="min-w-0 flex-1 truncate">{product.name}</span>
            <span className="text-zinc-500 tabular-nums">{formatCents(product.priceCents)}</span>
          </li>
        ))}
        {options.length === 0 && !isFetching && (
          <li className="px-3 py-3 text-sm text-zinc-500" role="presentation">
            No matches for “{query}”
          </li>
        )}
        {options.length > 0 && (
          <li role="presentation" className="border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={goToResults}
              className="w-full px-3 py-2 text-left text-sm text-accent hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              See all results for “{query}”
            </button>
          </li>
        )}
      </ul>
    </div>
  );
}
