'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItemRef {
  product_id: string;
  qty: number;
}

interface CartStoreState {
  slug: string;
  items: CartItemRef[];
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  initSlug: (slug: string) => void;
  addItem: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
}

/**
 * Cart store partitioned by slug in localStorage.
 * skipHydration is true to prevent SSR hydration mismatches.
 * Counter reads show 0 until rehydrate() runs.
 */
export const useCartStore = create<CartStoreState>()(
  persist(
    (set, get) => ({
      slug: '',
      items: [],
      _hasHydrated: false,

      setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),

      initSlug: (slug: string) => {
        if (get().slug !== slug) {
          set({ slug, items: [] });
        }
      },

      addItem: (productId: string) => {
        const currentItems = get().items;
        const existingIndex = currentItems.findIndex((i) => i.product_id === productId);

        if (existingIndex > -1) {
          const updated = [...currentItems];
          if (updated[existingIndex].qty < 99) {
            updated[existingIndex] = {
              ...updated[existingIndex],
              qty: updated[existingIndex].qty + 1,
            };
            set({ items: updated });
          }
        } else {
          set({ items: [...currentItems, { product_id: productId, qty: 1 }] });
        }
      },

      removeItem: (productId: string) => {
        const currentItems = get().items;
        const existing = currentItems.find((i) => i.product_id === productId);

        if (!existing) return;

        if (existing.qty > 1) {
          set({
            items: currentItems.map((i) =>
              i.product_id === productId ? { ...i, qty: i.qty - 1 } : i
            ),
          });
        } else {
          set({
            items: currentItems.filter((i) => i.product_id !== productId),
          });
        }
      },

      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'menuki-cart-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ slug: state.slug, items: state.items }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
