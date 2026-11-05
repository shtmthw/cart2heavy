import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { ApiError } from '../lib/api';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // a 4xx will not get better by asking again
      retry: (count, error) =>
        !(error instanceof ApiError && error.status < 500 && error.status !== 0) && count < 2,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster theme="system" position="bottom-center" closeButton />
    </QueryClientProvider>
  );
}
