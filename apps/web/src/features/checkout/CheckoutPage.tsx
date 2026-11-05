import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';
import { addressSchema, formatCents, type CheckoutResultDTO } from '@cart2heavy/shared';
import { Button, ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState } from '../../components/ui/empty-state';
import { TextField } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useCart } from '../../lib/cart';
import { applyApiError } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/hooks';
import { myOrdersQuery } from '../../lib/queries';
import { followUrl } from '../../lib/redirect';

type AddressForm = z.input<typeof addressSchema>;
const FIELDS = ['fullName', 'line1', 'line2', 'city', 'postalCode', 'country', 'phone'] as const;
const EMPTY: AddressForm = {
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  postalCode: '',
  country: '',
  phone: '',
};

export function CheckoutPage() {
  useDocumentTitle('Checkout');
  const { user } = useAuth();
  const { cart, isLoading } = useCart();
  const navigate = useNavigate();
  const orders = useQuery(myOrdersQuery);
  const [formError, setFormError] = useState<string | null>(null);

  // the address of the last order, so a returning customer only has to press "Pay"
  const last = orders.data?.[0]?.address;
  const form = useForm<AddressForm, unknown, z.output<typeof addressSchema>>({
    resolver: zodResolver(addressSchema),
    defaultValues: EMPTY,
    values: orders.isSuccess ? (last ?? { ...EMPTY, fullName: user?.name ?? '' }) : undefined,
  });
  const { register, handleSubmit, setError, formState } = form;
  const { errors } = formState;

  const checkout = useMutation({
    mutationFn: (address: z.output<typeof addressSchema>) =>
      api.post<CheckoutResultDTO>('/orders/checkout', { address }),
    onSuccess: ({ redirectUrl }) => followUrl(redirectUrl, navigate),
    onError: (error) => setFormError(applyApiError(error, setError, FIELDS, 'address.')),
  });

  if (isLoading || !cart || orders.isPending) {
    return (
      <Container className="max-w-4xl space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }

  if (cart.items.length === 0 || !cart.meetsMinimum) {
    return (
      <Container>
        <EmptyState
          title={cart.items.length === 0 ? 'Your cart is empty' : 'Your order is below the minimum'}
          action={<ButtonLink to="/cart">Back to cart</ButtonLink>}
        >
          {cart.items.length === 0
            ? 'Add something before checking out.'
            : `The minimum order is ${formatCents(cart.minOrderCents)}.`}
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container className="max-w-5xl">
      <PageHeader title="Checkout" description="Where should we send it?" />
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <form
          noValidate
          onSubmit={(event) => {
            setFormError(null);
            void handleSubmit((address) => checkout.mutateAsync(address).catch(() => undefined))(
              event,
            );
          }}
        >
          <Card className="space-y-4 p-5">
            <TextField
              label="Full name"
              autoComplete="name"
              error={errors.fullName?.message}
              {...register('fullName')}
            />
            <TextField
              label="Address"
              autoComplete="address-line1"
              error={errors.line1?.message}
              {...register('line1')}
            />
            <TextField
              label="Apartment, suite, etc. (optional)"
              autoComplete="address-line2"
              error={errors.line2?.message}
              {...register('line2')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="City"
                autoComplete="address-level2"
                error={errors.city?.message}
                {...register('city')}
              />
              <TextField
                label="Postal code"
                autoComplete="postal-code"
                error={errors.postalCode?.message}
                {...register('postalCode')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Country"
                autoComplete="country-name"
                error={errors.country?.message}
                {...register('country')}
              />
              <TextField
                label="Phone"
                type="tel"
                autoComplete="tel"
                error={errors.phone?.message}
                {...register('phone')}
              />
            </div>
            {formError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}
            <Button type="submit" className="w-full sm:w-auto" loading={checkout.isPending}>
              Continue to payment · {formatCents(cart.totalCents)}
            </Button>
          </Card>
        </form>

        <aside aria-label="Order summary">
          <Card className="space-y-3 p-4">
            <h2 className="font-semibold">Your order</h2>
            <ul className="space-y-2 text-sm">
              {cart.items.map((line) => (
                <li key={line.product.id} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {line.quantity} × {line.product.name}
                  </span>
                  <span className="tabular-nums">{formatCents(line.lineTotalCents)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 border-t border-zinc-200 pt-3 text-sm dark:border-zinc-800">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Delivery</dt>
                <dd className="tabular-nums">{formatCents(cart.deliveryCents)}</dd>
              </div>
              <div className="flex justify-between text-base font-semibold">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCents(cart.totalCents)}</dd>
              </div>
            </dl>
          </Card>
        </aside>
      </div>
    </Container>
  );
}
