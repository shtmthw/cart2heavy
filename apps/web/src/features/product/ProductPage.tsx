import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatCents, LIMITS } from '@cart2heavy/shared';
import { Button, ButtonLink } from '../../components/ui/button';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { Container } from '../../components/ui/page';
import { QuantityStepper } from '../../components/ui/quantity-stepper';
import { Skeleton } from '../../components/ui/skeleton';
import { ApiError, errorMessage } from '../../lib/api';
import { useCart } from '../../lib/cart';
import { useDocumentTitle } from '../../lib/hooks';
import { productQuery } from '../../lib/queries';
import { useAddToCart } from '../cart/useAddToCart';

export function ProductPage() {
  const { id = '' } = useParams();
  const { data: product, isPending, error, refetch } = useQuery(productQuery(id));
  const [quantity, setQuantity] = useState(1);
  const { addToCart, pendingId } = useAddToCart();
  const { quantityOf } = useCart();
  useDocumentTitle(product?.name);

  if (isPending) {
    return (
      <Container className="grid gap-8 md:grid-cols-2">
        <Skeleton className="aspect-[3/2] w-full" />
        <div className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Container>
    );
  }

  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      return (
        <Container>
          <EmptyState
            title="This product is not available"
            action={<ButtonLink to="/">Back to the shop</ButtonLink>}
          >
            It may have been removed or the link is wrong.
          </EmptyState>
        </Container>
      );
    }
    return (
      <Container>
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      </Container>
    );
  }

  const inCart = quantityOf(product.id);
  return (
    <Container>
      <Link
        to={product.category ? `/?category=${product.category.slug}` : '/'}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {product.category ? product.category.name : 'All products'}
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-800">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="aspect-[3/2] w-full object-cover"
          />
        </div>

        <div>
          {product.category && <p className="text-sm text-zinc-500">{product.category.name}</p>}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-semibold tabular-nums">
            {formatCents(product.priceCents)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            {product.totalBought > 0
              ? `Bought ${product.totalBought} ${product.totalBought === 1 ? 'time' : 'times'}`
              : 'Be the first to buy this'}
          </p>

          <p className="mt-5 leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {product.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.max(1, LIMITS.maxCartQuantity - inCart)}
            />
            <Button
              className="min-w-40"
              loading={pendingId === product.id}
              disabled={inCart >= LIMITS.maxCartQuantity}
              onClick={() => void addToCart(product, quantity).then(() => setQuantity(1))}
            >
              <ShoppingCart className="size-4" aria-hidden />
              Add to cart
            </Button>
          </div>
          {inCart > 0 && (
            <p className="mt-3 text-sm text-zinc-500">
              {inCart} in your cart ·{' '}
              <Link to="/cart" className="text-accent underline-offset-4 hover:underline">
                View cart
              </Link>
            </p>
          )}
        </div>
      </div>
    </Container>
  );
}
