import { Plus } from 'lucide-react';
import { Link } from 'react-router';
import { formatCents, type ProductDTO } from '@cart2heavy/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { useAddToCart } from '../cart/useAddToCart';

export function ProductCard({ product }: { product: ProductDTO }) {
  const { addToCart, pendingId } = useAddToCart();
  return (
    <Card className="flex flex-col overflow-hidden">
      <Link to={`/products/${product.id}`} className="group block">
        <div className="aspect-[3/2] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img
            src={product.imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
        <div className="space-y-0.5 p-3 pb-2">
          {product.category && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{product.category.name}</p>
          )}
          <h3 className="line-clamp-2 min-h-10 text-sm leading-5 font-medium">{product.name}</h3>
        </div>
      </Link>
      <div className="mt-auto flex items-center justify-between gap-2 p-3 pt-0">
        <p className="font-semibold tabular-nums">{formatCents(product.priceCents)}</p>
        <Button
          size="sm"
          variant="secondary"
          loading={pendingId === product.id}
          onClick={() => void addToCart(product)}
          aria-label={`Add ${product.name} to cart`}
        >
          <Plus className="size-4" aria-hidden />
          Add
        </Button>
      </div>
    </Card>
  );
}
