'use client';

import { useCartStore } from '@/stores/use-cart-store';

interface CartButtonProps {
  productId: string;
  productName: string;
  isAvailable: boolean;
}

/**
 * Client Component: Interactive quantity controls.
 * Uses fine-grained Zustand selectors to prevent unnecessary re-renders.
 * Shows 0 until client hydration completes.
 */
export function CartButton({
  productId,
  productName,
  isAvailable,
}: CartButtonProps) {
  // Fine-grained selectors
  const isHydrated = useCartStore((s) => s._hasHydrated);
  const qty = useCartStore((s) =>
    s._hasHydrated ? s.items.find((i) => i.product_id === productId)?.qty || 0 : 0
  );
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);

  if (!isAvailable) {
    return (
      <button
        type="button"
        disabled
        aria-label={`${productName} agotado`}
        className="inline-flex min-h-[44px] cursor-not-allowed items-center justify-center rounded-xl bg-neutral-100 px-4 py-2 text-xs font-bold text-neutral-400"
      >
        Agotado
      </button>
    );
  }

  if (qty === 0) {
    return (
      <button
        type="button"
        onClick={() => addItem(productId)}
        aria-label={`Agregar ${productName} al pedido`}
        className="inline-flex min-h-[44px] min-w-[80px] items-center justify-center rounded-xl bg-accent px-4 py-2 text-xs font-bold text-white shadow-sm transition-all duration-150 active:scale-95 hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-1"
      >
        Agregar
      </button>
    );
  }

  return (
    <div className="inline-flex min-h-[44px] items-center rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
      <button
        type="button"
        onClick={() => removeItem(productId)}
        aria-label={`Disminuir cantidad de ${productName}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-base font-bold text-neutral-700 transition active:scale-90 hover:bg-neutral-200"
      >
        -
      </button>
      <span className="min-w-[32px] text-center text-sm font-bold tabular-nums text-neutral-900">
        {isHydrated ? qty : 0}
      </span>
      <button
        type="button"
        onClick={() => addItem(productId)}
        aria-label={`Aumentar cantidad de ${productName}`}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-base font-bold text-white transition active:scale-90 hover:opacity-90"
      >
        +
      </button>
    </div>
  );
}
