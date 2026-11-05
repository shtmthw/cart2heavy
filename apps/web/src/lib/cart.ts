import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import {
  LIMITS,
  priceCart,
  type CartDTO,
  type CartLineDTO,
  type Paginated,
  type ProductDTO,
} from '@cart2heavy/shared';
import { api } from './api';
import { useAuth } from './auth';
import { guestCart } from './guestCart';
import { cartQuery, configQuery } from './queries';

/**
 * One cart for the whole app. Logged in: it lives on the server. Logged out: it lives in the
 * browser (localStorage). Both give the same `CartDTO`, computed with the same pricing rules.
 */
export function useCart() {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const guestLines = useSyncExternalStore(guestCart.subscribe, guestCart.getSnapshot);
  const { data: config } = useQuery(configQuery);

  const serverCart = useQuery({ ...cartQuery, enabled: !!user });

  const guestIds = guestLines.map((l) => l.productId);
  const guestProducts = useQuery({
    queryKey: ['guest-cart-products', guestIds.join(',')],
    queryFn: () =>
      api.get<Paginated<ProductDTO>>('/products', {
        ids: guestIds.join(','),
        limit: LIMITS.pageSizeMax,
      }),
    enabled: !authLoading && !user && guestIds.length > 0,
  });

  let cart: CartDTO | undefined;
  if (user) {
    cart = serverCart.data;
  } else if (config && (guestIds.length === 0 || guestProducts.data)) {
    const byId = new Map(guestProducts.data?.items.map((p) => [p.id, p]));
    const items: CartLineDTO[] = [];
    for (const line of guestLines) {
      const product = byId.get(line.productId);
      if (!product) continue; // no longer sold
      items.push({
        product: {
          id: product.id,
          name: product.name,
          priceCents: product.priceCents,
          imageUrl: product.imageUrl,
          isActive: true,
        },
        quantity: line.quantity,
        lineTotalCents: product.priceCents * line.quantity,
      });
    }
    const totals = priceCart(
      items.map((l) => ({
        priceCents: l.product.priceCents,
        quantity: l.quantity,
        isActive: true,
      })),
      config,
    );
    cart = { items, itemCount: items.reduce((n, l) => n + l.quantity, 0), ...totals };
  }

  const setServerQuantity = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      api.put<CartDTO>(`/cart/items/${productId}`, { quantity }),
    onSuccess: (next) => queryClient.setQueryData(cartQuery.queryKey, next),
  });
  const removeServerLine = useMutation({
    mutationFn: (productId: string) => api.delete<CartDTO>(`/cart/items/${productId}`),
    onSuccess: (next) => queryClient.setQueryData(cartQuery.queryKey, next),
  });

  const quantityOf = (productId: string): number =>
    user
      ? (serverCart.data?.items.find((l) => l.product.id === productId)?.quantity ?? 0)
      : (guestLines.find((l) => l.productId === productId)?.quantity ?? 0);

  return {
    cart,
    isLoading:
      authLoading || (user ? serverCart.isPending : !!guestIds.length && guestProducts.isPending),
    /** number of items, for the badge in the header */
    count: user
      ? (serverCart.data?.itemCount ?? 0)
      : guestLines.reduce((n, l) => n + l.quantity, 0),
    quantityOf,
    setQuantity: async (productId: string, quantity: number) => {
      if (user) await setServerQuantity.mutateAsync({ productId, quantity });
      else guestCart.setQuantity(productId, quantity);
    },
    add: async (productId: string, quantity = 1) => {
      const next = Math.min(quantityOf(productId) + quantity, LIMITS.maxCartQuantity);
      if (user) await setServerQuantity.mutateAsync({ productId, quantity: next });
      else guestCart.setQuantity(productId, next);
    },
    remove: async (productId: string) => {
      if (user) await removeServerLine.mutateAsync(productId);
      else guestCart.remove(productId);
    },
    isUpdating: setServerQuantity.isPending || removeServerLine.isPending,
  };
}
