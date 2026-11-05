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
import { RequireAuth } from './guards';
import { StoreLayout } from './layouts/StoreLayout';
import { NotFoundPage, RouteError } from './NotFound';

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
]);
