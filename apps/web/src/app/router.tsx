import { createBrowserRouter } from 'react-router';
import { AccountPage } from '../features/account/AccountPage';
import { LoginPage, RegisterPage } from '../features/auth/AuthForms';
import { HomePage } from '../features/catalog/HomePage';
import { CartPage } from '../features/cart/CartPage';
import { CheckoutPage } from '../features/checkout/CheckoutPage';
import { MockPaymentPage } from '../features/checkout/MockPaymentPage';
import { PaymentResultPage } from '../features/checkout/PaymentResultPage';
import { OrderDetailPage } from '../features/orders/OrderDetailPage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { ProductPage } from '../features/product/ProductPage';
import { SearchPage } from '../features/search/SearchPage';
import { Spinner } from '../components/ui/skeleton';
import { RequireAuth, RequireRole } from './guards';
import { StoreLayout } from './layouts/StoreLayout';
import { NotFoundPage, RouteError } from './NotFound';

/** Shown while a lazily loaded staff area is being downloaded on the very first page view. */
const PageSpinner = () => (
  <div className="grid min-h-dvh place-items-center">
    <Spinner className="size-6" />
  </div>
);

const RequireAdmin = () => <RequireRole roles={['admin']} />;
const RequireLogistics = () => <RequireRole roles={['logistics', 'admin']} />;

/** Admin and logistics screens are only downloaded by the people who use them. */
const staff = () => import('../features/admin/routes');

export const router = createBrowserRouter([
  {
    path: '/',
    Component: StoreLayout,
    ErrorBoundary: RouteError,
    children: [
      { index: true, Component: HomePage },
      { path: 'products/:id', Component: ProductPage },
      { path: 'search', Component: SearchPage },
      { path: 'cart', Component: CartPage },
      { path: 'login', Component: LoginPage },
      { path: 'register', Component: RegisterPage },
      {
        Component: RequireAuth,
        children: [
          { path: 'checkout', Component: CheckoutPage },
          { path: 'checkout/mock/:orderId', Component: MockPaymentPage },
          { path: 'checkout/result', Component: PaymentResultPage },
          { path: 'orders', Component: OrdersPage },
          { path: 'orders/:id', Component: OrderDetailPage },
          { path: 'account', Component: AccountPage },
        ],
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
  {
    path: '/admin',
    Component: RequireAdmin,
    HydrateFallback: PageSpinner,
    ErrorBoundary: RouteError,
    children: [
      {
        lazy: async () => ({ Component: (await staff()).AdminLayout }),
        children: [
          { index: true, lazy: async () => ({ Component: (await staff()).DashboardPage }) },
          { path: 'products', lazy: async () => ({ Component: (await staff()).ProductsPage }) },
          { path: 'categories', lazy: async () => ({ Component: (await staff()).CategoriesPage }) },
          { path: 'orders', lazy: async () => ({ Component: (await staff()).OrdersPage }) },
        ],
      },
    ],
  },
  {
    path: '/logistics',
    Component: RequireLogistics,
    HydrateFallback: PageSpinner,
    ErrorBoundary: RouteError,
    children: [
      {
        lazy: async () => ({ Component: (await staff()).LogisticsLayout }),
        children: [
          { index: true, lazy: async () => ({ Component: (await staff()).LogisticsPage }) },
        ],
      },
    ],
  },
]);
