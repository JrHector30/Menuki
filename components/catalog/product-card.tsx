import Image from 'next/image';
import type { Product } from '@/types/domain';
import { formatPEN } from '@/lib/utils/currency';
import { CartButton } from '@/components/cart/cart-button';

interface ProductCardProps {
  product: Product;
}

/**
 * Server Component: Product Card.
 * Renders thumbnail, price, description and out-of-stock badge on the server.
 * Only the +/- quantity button is a Client Component.
 */
export function ProductCard({ product }: ProductCardProps) {
  return (
    <article
      className={`flex gap-3.5 rounded-2xl border p-3.5 shadow-sm transition ${
        product.is_available
          ? 'border-neutral-100 bg-white hover:shadow-md'
          : 'border-neutral-200/60 bg-neutral-50/70 opacity-80'
      }`}
    >
      <div className="flex flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold text-neutral-900 leading-snug">{product.name}</h3>
            {!product.is_available && (
              <span className="flex-shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-bold text-neutral-600">
                Agotado
              </span>
            )}
          </div>

          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-neutral-500">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-base font-extrabold tabular-nums text-neutral-900">
            {formatPEN(Number(product.price))}
          </span>

          <CartButton
            productId={product.id}
            productName={product.name}
            isAvailable={product.is_available}
          />
        </div>
      </div>

      {product.image_url && (
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="96px"
            loading="lazy"
            className={`object-cover ${!product.is_available ? 'grayscale' : ''}`}
          />
        </div>
      )}
    </article>
  );
}
