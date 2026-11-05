import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { PRODUCT_SORTS, type ProductSort } from '@cart2heavy/shared';
import { CompactSelect } from '../../components/ui/field';
import { Container } from '../../components/ui/page';
import { Pagination } from '../../components/ui/pagination';
import { useDocumentTitle } from '../../lib/hooks';
import { categoriesQuery, productsQuery } from '../../lib/queries';
import { cn } from '../../lib/utils';
import { MostBought } from './MostBought';
import { NoProducts, ProductGrid } from './ProductGrid';

export const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Newest',
  popular: 'Most popular',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

export function parseSort(value: string | null): ProductSort {
  return PRODUCT_SORTS.find((s) => s === value) ?? 'newest';
}

export function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-accent bg-accent text-white'
          : 'border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  );
}

export function HomePage() {
  useDocumentTitle(undefined);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? undefined;
  const sort = parseSort(params.get('sort'));
  const page = parsePage(params.get('page'));

  const categories = useQuery(categoriesQuery);
  const products = useQuery(productsQuery({ category, sort, page }));

  // the URL is the single source of truth, so links and refreshes keep the filters
  const update = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, value);
    }
    setParams(next);
  };

  return (
    <Container>
      <section className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Everything for your build, delivered heavy.
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Motherboards, laptops, phones and desktops – ordered in a minute, tracked to your door.
        </p>
      </section>

      {!category && page === 1 && <MostBought />}

      <section aria-label="Products">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
            <Chip
              active={!category}
              onClick={() => update({ category: undefined, page: undefined })}
            >
              All
            </Chip>
            {categories.data
              ?.filter((c) => (c.productCount ?? 0) > 0)
              .map((c) => (
                <Chip
                  key={c.id}
                  active={category === c.slug}
                  onClick={() => update({ category: c.slug, page: undefined })}
                >
                  {c.name}
                </Chip>
              ))}
          </div>
          <CompactSelect
            label="Sort products"
            value={sort}
            onChange={(event) =>
              update({
                sort: event.target.value === 'newest' ? undefined : event.target.value,
                page: undefined,
              })
            }
          >
            {PRODUCT_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </CompactSelect>
        </div>

        <ProductGrid
          query={products}
          empty={<NoProducts>There is nothing in this category yet.</NoProducts>}
        />
        <Pagination
          page={products.data?.page ?? page}
          totalPages={products.data?.totalPages ?? 1}
          onPageChange={(next) => update({ page: next === 1 ? undefined : String(next) })}
        />
      </section>
    </Container>
  );
}
