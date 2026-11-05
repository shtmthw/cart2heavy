import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, Role, UserDTO } from '@cart2heavy/shared';
import { api } from './api';
import { guestCart } from './guestCart';
import { meQuery } from './queries';

/** After logging in, the browser-only cart is moved into the account's cart. */
async function mergeGuestCart() {
  const items = guestCart.getSnapshot();
  if (items.length === 0) return;
  try {
    await api.post('/cart/merge', { items });
    guestCart.clear();
  } catch {
    // keep the guest cart; the next login will try again
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const { data, isPending } = useQuery(meQuery);

  const afterLogin = async (user: UserDTO) => {
    queryClient.setQueryData(meQuery.queryKey, user);
    await mergeGuestCart();
    await queryClient.invalidateQueries({ queryKey: ['cart'] });
    await queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const login = useMutation({
    mutationFn: async (input: LoginInput) => {
      const user = await api.post<UserDTO>('/auth/login', input);
      await afterLogin(user);
      return user;
    },
  });

  const register = useMutation({
    mutationFn: async (input: RegisterInput) => {
      const user = await api.post<UserDTO>('/auth/register', input);
      await afterLogin(user);
      return user;
    },
  });

  const logout = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      queryClient.clear(); // nothing of the previous user may stay in memory
      queryClient.setQueryData(meQuery.queryKey, null);
    },
  });

  return {
    user: data ?? null,
    isLoading: isPending,
    login,
    register,
    logout,
  };
}

/** The place a role lands after logging in. */
export function homeFor(role: Role | undefined): string {
  if (role === 'admin') return '/admin';
  if (role === 'logistics') return '/logistics';
  return '/';
}
