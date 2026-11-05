import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import type { ProductDTO } from '@cart2heavy/shared';
import { errorMessage } from '../../lib/api';
import { useCart } from '../../lib/cart';

/** "Add to cart" with a toast (instead of the old `window.alert`). */
export function useAddToCart() {
  const { add } = useCart();
  const navigate = useNavigate();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const addToCart = async (product: Pick<ProductDTO, 'id' | 'name'>, quantity = 1) => {
    setPendingId(product.id);
    try {
      await add(product.id, quantity);
      toast.success(`${product.name} added to your cart`, {
        action: { label: 'View cart', onClick: () => void navigate('/cart') },
      });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  return { addToCart, pendingId };
}
