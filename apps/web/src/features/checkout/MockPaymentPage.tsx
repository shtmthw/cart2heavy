import { useMutation, useQuery } from '@tanstack/react-query';
import { FlaskConical } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { formatCents } from '@cart2heavy/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { ErrorState } from '../../components/ui/empty-state';
import { Container } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { api, errorMessage } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks';

interface MockPayment {
  orderId: string;
  amountCents: number;
  status: 'open' | 'paid' | 'cancelled';
}

/** Stands in for the payment company's page when PAYMENT_PROVIDER=mock. */
export function MockPaymentPage() {
  useDocumentTitle('Test payment');
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const payment = useQuery({
    queryKey: ['mock-payment', orderId],
    queryFn: () => api.get<MockPayment>(`/payments/mock/${orderId}`),
  });

  const settle = useMutation({
    mutationFn: (outcome: 'pay' | 'cancel') => api.post(`/payments/mock/${orderId}/${outcome}`),
    onSuccess: (_data, outcome) =>
      void navigate(
        `/checkout/result?orderId=${orderId}${outcome === 'cancel' ? '&cancelled=1' : ''}`,
      ),
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (payment.isPending) {
    return (
      <Container className="max-w-md">
        <Skeleton className="h-64 w-full" />
      </Container>
    );
  }
  if (payment.isError) {
    return (
      <Container>
        <ErrorState message={errorMessage(payment.error)} />
      </Container>
    );
  }
  if (payment.data.status !== 'open') {
    return <Navigate to={`/checkout/result?orderId=${orderId}`} replace />;
  }

  return (
    <Container className="max-w-md">
      <Card className="space-y-5 p-6 text-center">
        <FlaskConical className="mx-auto size-8 text-accent" aria-hidden />
        <div>
          <h1 className="text-xl font-semibold">Test payment</h1>
          <p className="mt-1 text-sm text-zinc-500">
            This is a simulated payment page. No real money moves. Set{' '}
            <code>STRIPE_SECRET_KEY</code> to use Stripe.
          </p>
        </div>
        <p className="text-3xl font-semibold tabular-nums">
          {formatCents(payment.data.amountCents)}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            loading={settle.isPending && settle.variables === 'pay'}
            disabled={settle.isPending}
            onClick={() => settle.mutate('pay')}
          >
            Pay {formatCents(payment.data.amountCents)}
          </Button>
          <Button
            variant="secondary"
            disabled={settle.isPending}
            onClick={() => settle.mutate('cancel')}
          >
            Cancel payment
          </Button>
        </div>
      </Card>
    </Container>
  );
}
