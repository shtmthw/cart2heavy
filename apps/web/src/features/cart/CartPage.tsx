import { ShoppingBag, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { formatCents } from '@cart2heavy/shared';
import { Badge } from '../../components/ui/badge';
import { Button, ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { Container, PageHeader } from '../../components/ui/page';
import { QuantityStepper } from '../../components/ui/quantity-stepper';
import { Skeleton } from '../../components/ui/skeleton';
import { errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cart';
import { useDocumentTitle } from '../../lib/hooks';

export function CartPage() {
  useDocumentTitle('Cart');
  const { user } = useAuth();
  const { cart, isLoading, setQuantity, remove, isUpdating } = useCart();
  const navigate = useNavigate();

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (isLoading || !cart) {
    return (
      <Container className="max-w-4xl space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </Container>
    );
  }

  if (cart.items.length === 0) {
    return (
      <Container>
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          action={<ButtonLink to="/">Browse products</ButtonLink>}
        >
          Add something you like and it will show up here.
        </EmptyState>
      </Container>
    );
  }

  const unavailable = cart.items.some((l) => !l.product.isActive);
  const missing = Math.max(0, cart.minOrderCents - cart.subtotalCents);

  return (
    <Container className="max-w-5xl">
      <PageHeader title="Your cart" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <ul className="space-y-3">
          {cart.items.map((line) => (
            <li key={line.product.id}>
              <Card className="flex gap-3 p-3 sm:gap-4">
                <Link to={`/products/${line.product.id}`} className="shrink-0">
                  <img
                    src={line.product.imageUrl}
                    alt=""
                    className="size-20 rounded object-cover sm:size-24"
                  />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        to={`/products/${line.product.id}`}
                        className="line-clamp-2 text-sm font-medium hover:underline"
                      >
                        {line.product.name}
                      </Link>
                      <p className="text-sm text-zinc-500 tabular-nums">
                        {formatCents(line.product.priceCents)} each
                      </p>
                      {!line.product.isActive && <Badge tone="danger">No longer available</Badge>}
                    </div>
                    <p className="font-semibold tabular-nums">
                      {line.product.isActive ? formatCents(line.lineTotalCents) : '—'}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between">
                    <QuantityStepper
                      value={line.quantity}
                      disabled={isUpdating || !line.product.isActive}
                      label={`Quantity of ${line.product.name}`}
                      onChange={(quantity) =>
                        void run(() => setQuantity(line.product.id, quantity))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove ${line.product.name}`}
                      onClick={() => void run(() => remove(line.product.id))}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      <span className="hidden sm:inline">Remove</span>
                    </Button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>

        <aside aria-label="Order summary">
          <Card className="space-y-3 p-4 lg:sticky lg:top-24">
            <h2 className="font-semibold">Summary</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Subtotal</dt>
                <dd className="tabular-nums">{formatCents(cart.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Delivery</dt>
                <dd className="tabular-nums">{formatCents(cart.deliveryCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold dark:border-zinc-800">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCents(cart.totalCents)}</dd>
              </div>
            </dl>

            {!cart.meetsMinimum && cart.subtotalCents > 0 && (
              <p
                role="status"
                className="rounded-md bg-amber-50 p-2.5 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200"
              >
                The minimum order is {formatCents(cart.minOrderCents)}. Add {formatCents(missing)}{' '}
                more to check out.
              </p>
            )}
            {unavailable && (
              <p
                role="status"
                className="rounded-md bg-red-50 p-2.5 text-sm text-red-900 dark:bg-red-950 dark:text-red-200"
              >
                Remove the unavailable items to continue.
              </p>
            )}

            {user ? (
              <Button
                className="w-full"
                disabled={!cart.meetsMinimum || unavailable}
                onClick={() => void navigate('/checkout')}
              >
                Checkout
              </Button>
            ) : (
              <ButtonLink to="/login?next=/checkout" className="w-full">
                Log in to check out
              </ButtonLink>
            )}
          </Card>
        </aside>
      </div>
    </Container>
  );
}
