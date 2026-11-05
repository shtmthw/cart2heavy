import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import type {
  AdminStatsDTO,
  CategoryDTO,
  OrderDTO,
  Paginated,
  ProductDTO,
} from '@cart2heavy/shared';
import { api } from '../../lib/api';

type Params = Record<string, string | number | boolean | null | undefined>;

export const adminStatsQuery = queryOptions({
  queryKey: ['admin', 'stats'],
  queryFn: () => api.get<AdminStatsDTO>('/admin/stats'),
});

export const adminCategoriesQuery = queryOptions({
  queryKey: ['admin', 'categories'],
  queryFn: () => api.get<CategoryDTO[]>('/admin/categories'),
});

export const adminProductsQuery = (params: Params) =>
  queryOptions({
    queryKey: ['admin', 'products', params],
    queryFn: ({ signal }) => api.get<Paginated<ProductDTO>>('/admin/products', params, signal),
    placeholderData: keepPreviousData,
  });

export const adminOrdersQuery = (params: Params) =>
  queryOptions({
    queryKey: ['admin', 'orders', params],
    queryFn: ({ signal }) => api.get<Paginated<OrderDTO>>('/admin/orders', params, signal),
    placeholderData: keepPreviousData,
  });
