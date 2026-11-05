'use client';

import { useEffect } from 'react';
import { useCartStore } from '@/stores/use-cart-store';

interface CartHydrationProps {
  slug: string;
}

/**
 * Client Component mounted once per store catalog page.
 * Safely rehydrates Zustand and chains initSlug afterwards.
 */
export function CartHydration({ slug }: CartHydrationProps) {
  useEffect(() => {
    Promise.resolve(useCartStore.persist.rehydrate()).then(() => {
      useCartStore.getState().initSlug(slug);
    });
  }, [slug]);

  return null;
}
