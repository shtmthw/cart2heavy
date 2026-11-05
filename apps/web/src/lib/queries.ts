import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type {
  AppConfigDTO,
  CartDTO,
  CategoryDTO,
  OrderDTO,
  Paginated,
  ProductDTO,
  ProductSuggestionDTO,
  UserDTO,
} from '@cart2heavy/shared';
import { api, ApiError } from './api';

type Params = Record<string, string | number | boolean | null | undefined>;

/** The logged in user, or null when nobody is logged in. */
export const meQuery = queryOptions({
  queryKey: ['me'],
  queryFn: async () => (await api.get<{ user: UserDTO | null }>('/auth/me')).user,
  staleTime: 5 * 60_000,
});

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: () => api.get<AppConfigDTO>('/config'),
  staleTime: Infinity,
});

export const categoriesQuery = queryOptions({
  queryKey: ['categories'],
  queryFn: () => api.get<CategoryDTO[]>('/categories'),
  staleTime: 60_000,
});

export const productsQuery = (params: Params) =>
  queryOptions({
    queryKey: ['products', params],
    queryFn: ({ signal }) => api.get<Paginated<ProductDTO>>('/products', params, signal),
    placeholderData: keepPreviousData,
  });

export const productQuery = (id: string) =>
  queryOptions({
    queryKey: ['product', id],
    queryFn: () => api.get<ProductDTO>(`/products/${id}`),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });

export const suggestQuery = (q: string) =>
  queryOptions({
    queryKey: ['suggest', q],
    queryFn: ({ signal }) => api.get<ProductSuggestionDTO[]>('/products/suggest', { q }, signal),
    staleTime: 60_000,
  });

export const cartQuery = queryOptions({
  queryKey: ['cart'],
  queryFn: () => api.get<CartDTO>('/cart'),
});

export const myOrdersQuery = queryOptions({
  queryKey: ['orders', 'mine'],
  queryFn: () => api.get<OrderDTO[]>('/orders/mine'),
});

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ['orders', id],
    queryFn: () => api.get<OrderDTO>(`/orders/${id}`),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  });
