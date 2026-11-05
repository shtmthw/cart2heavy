import { useQuery } from '@tanstack/react-query';
import { PRODUCT_SORTS, type ProductSort } from '@cart2heavy/shared';
import { CompactSelect } from '../../components/ui/field';
import { Container } from '../../components/ui/page';
import { Pagination } from '../../components/ui/pagination';
import { useDocumentTitle } from '../../lib/hooks';
import { categoriesQuery, productsQuery } from '../../lib/queries';
import { useQueryParams } from '../../lib/useQueryParams';
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
        'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-all duration-150',
        active
          ? 'border-accent bg-accent text-ink shadow-sm'
          : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  );
}

export function HomePage() {
  useDocumentTitle(undefined);
  const [params, update] = useQueryParams();
  const category = params.get('category') ?? undefined;
  const sort = parseSort(params.get('sort'));
  const page = parsePage(params.get('page'));

  const categories = useQuery(categoriesQuery);
  const products = useQuery(productsQuery({ category, sort, page }));

  return (
    <Container>
      <section className="mb-10 max-w-3xl pt-2 sm:pt-6">
        <h1 className="text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
          Everything for your build, delivered heavy.
        </h1>
        <p className="mt-3 text-base text-zinc-600 sm:text-lg dark:text-zinc-400">
          Motherboards, laptops, phones and desktops – ordered in a minute, tracked to your door.
        </p>
      </section>

      {!category && page === 1 && <MostBought />}

      <section aria-label="Products">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-3">
          <div
            className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] min-w-0 gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:w-auto sm:flex-1 sm:flex-wrap sm:px-0"
            role="group"
            aria-label="Categories"
          >
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
            prefix="Sort"
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
