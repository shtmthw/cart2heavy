import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { Paginated, ProductDTO } from '@cart2heavy/shared';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { Skeleton } from '../../components/ui/skeleton';
import { errorMessage } from '../../lib/api';
import { ProductCard } from './ProductCard';

const grid = 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4';

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={grid} aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="aspect-[3/2] w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

/** Loading skeletons, error, empty state or the grid – for any product list query. */
export function ProductGrid({
  query,
  empty,
}: {
  query: UseQueryResult<Paginated<ProductDTO>>;
  empty: ReactNode;
}) {
  if (query.isPending) return <ProductGridSkeleton />;
  if (query.isError)
    return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />;
  if (query.data.items.length === 0) return <>{empty}</>;
  return (
    <div className={grid} aria-busy={query.isPlaceholderData}>
      {query.data.items.map((product, index) => (
        <ProductCard key={product.id} product={product} index={index} />
      ))}
    </div>
  );
}

export function NoProducts({
  title = 'No products found',
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  return <EmptyState title={title}>{children}</EmptyState>;
}
