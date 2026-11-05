import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { formatCents } from '@cart2heavy/shared';
import { Card } from '../../components/ui/card';
import { productsQuery } from '../../lib/queries';

/** The three products people bought most. Hidden until something has been sold. */
export function MostBought() {
  const { data } = useQuery(productsQuery({ sort: 'popular', limit: 3 }));
  const top = data?.items.filter((p) => p.totalBought > 0) ?? [];
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="most-bought" className="mb-10">
      <h2
        id="most-bought"
        className="mb-3 text-xs font-semibold tracking-widest text-zinc-500 uppercase"
      >
        Most bought
      </h2>
      <ol className="no-scrollbar -mx-4 flex scroll-pl-4 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
        {top.map((product, index) => (
          <li key={product.id} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <Link to={`/products/${product.id}`} className="block">
              <Card className="flex items-center gap-3 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <span className="w-5 text-center text-lg font-semibold text-accent tabular-nums">
                  {index + 1}
                </span>
                <img
                  src={product.imageUrl}
                  alt=""
                  className="size-14 shrink-0 rounded object-cover"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{product.name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatCents(product.priceCents)} · bought {product.totalBought}×
                  </p>
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
