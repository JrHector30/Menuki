import Image from 'next/image';
import type { Store } from '@/types/domain';
import { OpenStatusBadge } from '@/components/catalog/open-status-badge';

interface StoreHeaderProps {
  store: Store;
}

/**
 * Server Component: Store Header.
 * Renders brand identity and delegates dynamic America/Lima status calculation to OpenStatusBadge.
 */
export function StoreHeader({ store }: StoreHeaderProps) {
  return (
    <header className="border-b border-neutral-100 bg-white px-4 pb-5 pt-6">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start gap-4">
          {store.logo_url && (
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-neutral-100 bg-neutral-50 shadow-sm">
              <Image
                src={store.logo_url}
                alt={store.name}
                fill
                priority
                sizes="64px"
                className="object-cover"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight text-neutral-900">
              {store.name}
            </h1>

            <div className="mt-1">
              <OpenStatusBadge
                openingHours={store.opening_hours}
                isOpenManual={store.is_open_manual}
              />
            </div>

            {(store.yape_number || store.plin_number) && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-600">
                <span className="font-medium text-neutral-400">Acepta:</span>
                {store.yape_number && (
                  <span className="rounded bg-purple-50 px-1.5 py-0.5 font-bold text-purple-700">
                    Yape
                  </span>
                )}
                {store.plin_number && (
                  <span className="rounded bg-sky-50 px-1.5 py-0.5 font-bold text-sky-700">
                    Plin
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
