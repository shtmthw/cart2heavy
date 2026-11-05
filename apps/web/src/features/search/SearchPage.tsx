import { useQuery } from '@tanstack/react-query';
import { SearchX } from 'lucide-react';
import { PRODUCT_SORTS } from '@cart2heavy/shared';
import { EmptyState } from '../../components/ui/empty-state';
import { CompactSelect } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { Pagination } from '../../components/ui/pagination';
import { useDocumentTitle } from '../../lib/hooks';
import { productsQuery } from '../../lib/queries';
import { useQueryParams } from '../../lib/useQueryParams';
import { parsePage, parseSort, SORT_LABELS } from '../catalog/HomePage';
import { ProductGrid } from '../catalog/ProductGrid';

export function SearchPage() {
  const [params, update] = useQueryParams();
  const q = params.get('q')?.trim() ?? '';
  const sort = parseSort(params.get('sort'));
  const page = parsePage(params.get('page'));
  useDocumentTitle(q ? `Search: ${q}` : 'Search');

  const products = useQuery({ ...productsQuery({ q, sort, page }), enabled: q.length > 0 });

  if (!q) {
    return (
      <Container>
        <EmptyState icon={SearchX} title="What are you looking for?">
          Type a product name in the search box above.
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <PageHeader
        title={`Results for “${q}”`}
        description={
          products.data
            ? `${products.data.total} ${products.data.total === 1 ? 'product' : 'products'}`
            : undefined
        }
        actions={
          <CompactSelect
            label="Sort results"
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
        }
      />
      <ProductGrid
        query={products}
        empty={
          <EmptyState icon={SearchX} title="No products found">
            Nothing matches “{q}”. Try a shorter or different word.
          </EmptyState>
        }
      />
      <Pagination
        page={products.data?.page ?? page}
        totalPages={products.data?.totalPages ?? 1}
        onPageChange={(next) => update({ page: next === 1 ? undefined : String(next) })}
      />
    </Container>
  );
}
