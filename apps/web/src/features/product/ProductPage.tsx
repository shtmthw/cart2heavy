import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BellRing, PackageCheck, ShieldCheck, ShoppingCart, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatCents, LIMITS, WEIGHT_LABELS } from '@cart2heavy/shared';
import { Button, ButtonLink } from '../../components/ui/button';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { Container } from '../../components/ui/page';
import { QuantityStepper } from '../../components/ui/quantity-stepper';
import { StickyBar } from '../../components/ui/sticky-bar';
import { Skeleton } from '../../components/ui/skeleton';
import { ApiError, errorMessage } from '../../lib/api';
import { useCart } from '../../lib/cart';
import { useDocumentTitle } from '../../lib/hooks';
import { configQuery, productQuery, productsQuery } from '../../lib/queries';
import { Card } from '../../components/ui/card';
import { ProductCard } from '../catalog/ProductCard';
import { useAddToCart } from '../cart/useAddToCart';

export function ProductPage() {
  const { id = '' } = useParams();
  const { data: product, isPending, error, refetch } = useQuery(productQuery(id));
  const [quantity, setQuantity] = useState(1);
  const { data: config } = useQuery(configQuery);
  const categorySlug = product?.category?.slug;
  const related = useQuery({
    ...productsQuery({ category: categorySlug, limit: 5, sort: 'popular' }),
    enabled: !!categorySlug,
  });
  const { addToCart, pendingId } = useAddToCart();
  const { quantityOf } = useCart();
  useDocumentTitle(product?.name);

  if (isPending) {
    return (
      <Container className="grid grid-cols-1 gap-8 md:grid-cols-2">
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
    <Container className="pb-28 md:pb-0">
      <Link
        to={product.category ? `/?category=${product.category.slug}` : '/'}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {product.category ? product.category.name : 'All products'}
      </Link>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
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

          <ul className="mt-5 flex flex-wrap gap-2 text-sm">
            {product.category && (
              <li className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">
                {product.category.name}
              </li>
            )}
            {product.category && (
              <li className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">
                Package {WEIGHT_LABELS[product.category.weight].code} ·{' '}
                {WEIGHT_LABELS[product.category.weight].label}
              </li>
            )}
            {config && (
              <li className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">
                {formatCents(config.deliveryCents)} delivery
              </li>
            )}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={Math.max(1, LIMITS.maxCartQuantity - inCart)}
            />
            <Button
              className="hidden min-w-40 md:inline-flex"
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

      <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-semibold">About this item</h2>
            <p className="leading-relaxed whitespace-pre-line text-zinc-300">
              {product.description}
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Details</h2>
            <dl className="divide-y divide-zinc-800 text-sm">
              {[
                ['Product', product.name],
                ['Category', product.category?.name ?? '—'],
                [
                  'Package size',
                  product.category
                    ? `${WEIGHT_LABELS[product.category.weight].code} · ${WEIGHT_LABELS[product.category.weight].label}`
                    : '—',
                ],
                ['Price', formatCents(product.priceCents)],
                ['Sold so far', String(product.totalBought)],
                ['Item number', product.id.slice(-8).toUpperCase()],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-zinc-400">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <aside className="space-y-6" aria-label="Delivery and service">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Delivery</h2>
            <ul className="space-y-4 text-sm">
              <li className="flex gap-3">
                <Truck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block font-medium">
                    {config ? formatCents(config.deliveryCents) : '…'} flat delivery
                  </span>
                  <span className="text-zinc-400">
                    One fee per order, however many items you add.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <PackageCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block font-medium">
                    Minimum order {config ? formatCents(config.minOrderCents) : '…'}
                  </span>
                  <span className="text-zinc-400">Counted on the items, before delivery.</span>
                </span>
              </li>
              <li className="flex gap-3">
                <BellRing className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block font-medium">Track every step</span>
                  <span className="text-zinc-400">
                    Confirmed, shipped, out for delivery – with an email at the key moments.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block font-medium">Secure checkout</span>
                  <span className="text-zinc-400">
                    Prices are checked on our server, never in your browser.
                  </span>
                </span>
              </li>
            </ul>
          </Card>
        </aside>
      </div>

      {related.data && related.data.items.filter((p) => p.id !== product.id).length > 0 && (
        <section className="mt-14" aria-labelledby="related">
          <h2 id="related" className="mb-4 text-lg font-semibold">
            More in {product.category?.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.data.items
              .filter((p) => p.id !== product.id)
              .slice(0, 4)
              .map((p, index) => (
                <ProductCard key={p.id} product={p} index={index} />
              ))}
          </div>
        </section>
      )}
      <StickyBar>
        <div className="shrink-0">
          <p className="text-xs text-zinc-400">Price</p>
          <p className="text-lg leading-tight font-semibold tabular-nums">
            {formatCents(product.priceCents * quantity)}
          </p>
        </div>
        <Button
          className="flex-1"
          loading={pendingId === product.id}
          disabled={inCart >= LIMITS.maxCartQuantity}
          onClick={() => void addToCart(product, quantity).then(() => setQuantity(1))}
        >
          <ShoppingCart className="size-4" aria-hidden />
          Add to cart
        </Button>
      </StickyBar>
    </Container>
  );
}
