import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  formatCents,
  shortOrderId,
  type CheckoutResultDTO,
  type OrderDTO,
} from '@cart2heavy/shared';
import { Button, ButtonLink } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { Container } from '../../components/ui/page';
import { Spinner } from '../../components/ui/skeleton';
import { api, errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';
import { followUrl } from '../../lib/redirect';

/**
 * The customer lands here after the payment page. The URL says nothing about the outcome – we
 * ask the server, which asks the payment provider.
 */
export function PaymentResultPage() {
  useDocumentTitle('Payment');
  const [params] = useSearchParams();
  const orderId = params.get('orderId') ?? '';
  const cancelled = params.get('cancelled') === '1';
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const result = useQuery({
    queryKey: ['verify-payment', orderId],
    queryFn: () => api.post<OrderDTO>(`/orders/${orderId}/verify`),
    enabled: !!orderId,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
    gcTime: 0,
  });

  // the cart was emptied / the order changed on the server
  useEffect(() => {
    if (result.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ['cart'] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  }, [result.isSuccess, queryClient]);

  const retry = useMutation({
    mutationFn: () => api.post<CheckoutResultDTO>(`/orders/${orderId}/pay`),
    onSuccess: ({ redirectUrl }) => followUrl(redirectUrl, navigate),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (!orderId) {
    return (
      <Container>
        <EmptyState
          title="Nothing to show"
          action={<ButtonLink to="/orders">My orders</ButtonLink>}
        />
      </Container>
    );
  }
  if (result.isPending) {
    return (
      <Container className="max-w-md">
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Spinner className="size-8" label="Confirming your payment" />
          <p className="text-sm text-zinc-500">Confirming your payment…</p>
        </div>
      </Container>
    );
  }
  if (result.isError) {
    return (
      <Container>
        <ErrorState message={errorMessage(result.error)} onRetry={() => void result.refetch()} />
      </Container>
    );
  }

  const order = result.data;
  const paid = order.payment.status === 'paid';
  return (
    <Container className="max-w-md">
      <Card className="space-y-4 p-6 text-center">
        {paid ? (
          <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
        ) : (
          <XCircle className="mx-auto size-10 text-amber-600" aria-hidden />
        )}
        <div role="status">
          <h1 className="text-xl font-semibold">
            {paid ? 'Thank you, your payment was received' : 'Payment not completed'}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {paid
              ? `Order ${shortOrderId(order.id)} · ${formatCents(order.totalCents)}. We sent a confirmation to ${order.email}.`
              : cancelled
                ? 'You cancelled the payment. Your cart is still waiting for you.'
                : 'We did not receive the payment yet. Your cart is still waiting for you.'}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {paid ? (
            <>
              <ButtonLink to={`/orders/${order.id}`}>Track your order</ButtonLink>
              <ButtonLink to="/" variant="secondary">
                Keep shopping
              </ButtonLink>
            </>
          ) : (
            <>
              <Button loading={retry.isPending} onClick={() => retry.mutate()}>
                Try payment again
              </Button>
              <ButtonLink to="/cart" variant="secondary">
                Back to cart
              </ButtonLink>
            </>
          )}
        </div>
      </Card>
    </Container>
  );
}
