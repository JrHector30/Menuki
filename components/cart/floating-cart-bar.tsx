'use client';

import { useState } from 'react';
import { useCartStore } from '@/stores/use-cart-store';
import { formatPEN } from '@/lib/utils/currency';
import { CheckoutDialog } from '@/components/cart/checkout-dialog';
import type { Store } from '@/types/domain';

export interface CatalogItemPreview {
  id: string;
  name: string;
  price: number;
  is_available: boolean;
}

interface FloatingCartBarProps {
  store: Store;
  products: CatalogItemPreview[];
  slug: string;
}

/**
 * Client Component: Floating bottom bar rendered as an accessible button.
 * Opens the native <dialog> checkout drawer.
 */
export function FloatingCartBar({ store, products, slug }: FloatingCartBarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const isHydrated = useCartStore((s) => s._hasHydrated);
  const items = useCartStore((s) => s.items);

  if (!isHydrated) return null;

  // Build product lookup map to validate availability and extract prices
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Discard items not found in catalog or marked as unavailable
  const validItems = items.flatMap((item) => {
    const product = productMap.get(item.product_id);
    if (!product || !product.is_available) {
      return [];
    }
    return [{ qty: item.qty, price: product.price }];
  });

  const totalCount = validItems.reduce((acc, i) => acc + i.qty, 0);
  const totalPrice = validItems.reduce((acc, i) => acc + i.price * i.qty, 0);

  if (totalCount === 0) return null;

  return (
    <>
      <aside
        aria-label="Barra flotante de pedido"
        className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-safe pointer-events-none"
      >
        <div className="mx-auto max-w-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            aria-label={`Ver pedido de ${totalCount} productos por ${formatPEN(totalPrice)}`}
            className="flex min-h-[56px] w-full items-center justify-between rounded-2xl bg-accent p-3.5 px-5 text-white shadow-xl transition-all duration-200 active:scale-[0.99] hover:opacity-95"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-xs font-bold tabular-nums">
                {totalCount}
              </span>
              <span className="text-sm font-semibold">
                {totalCount === 1 ? '1 producto' : `${totalCount} productos`}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-base font-bold tabular-nums">
                {formatPEN(Number(totalPrice.toFixed(2)))}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Ver pedido →
              </span>
            </div>
          </button>
        </div>
      </aside>

      <CheckoutDialog
        store={store}
        products={products}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}
