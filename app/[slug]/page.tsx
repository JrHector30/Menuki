import { notFound } from 'next/navigation';
import { getStoreCatalog } from '@/lib/catalog/get-store-catalog';
import { StoreHeader } from '@/components/catalog/store-header';
import { CategoryNav } from '@/components/catalog/category-nav';
import { ProductCard } from '@/components/catalog/product-card';
import { FloatingCartBar, type CatalogItemPreview } from '@/components/cart/floating-cart-bar';
import { CartHydration } from '@/components/cart/cart-hydration';
import { hexToRgb } from '@/lib/utils/colors';
import type { Metadata } from 'next';

/**
 * Revalidate cache every 60 seconds (Incremental Static Regeneration).
 * When admin edits data in Phase 4, trigger: revalidatePath(`/${slug}`)
 */
export const revalidate = 60;

/**
 * Static params returns empty array to allow on-demand SSG / ISR rendering
 * for multi-tenant slugs while enabling Next.js static prerender symbols (●).
 */
export function generateStaticParams() {
  return [];
}

interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getStoreCatalog(slug);

  if (!catalog) {
    return { title: 'Tienda no encontrada' };
  }

  return {
    title: `${catalog.store.name} | Catálogo Digital`,
    description: `Realiza tu pedido en línea de ${catalog.store.name}`,
  };
}

/**
 * Public Store Catalog Page.
 * Pure Server Component: StoreHeader, CategoryNav, and Product Cards are rendered on the server.
 * Only the interactive quantity buttons, the hydration coordinator and floating cart bar run on the client.
 */
export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;
  const catalog = await getStoreCatalog(slug);

  if (!catalog) {
    notFound();
  }

  const { store, categories, uncategorizedProducts } = catalog;

  // Render inactive notice if store membership is suspended
  if (!store.is_active) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-4 text-center text-neutral-900">
        <div className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-8 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="mt-5 text-xl font-bold tracking-tight text-neutral-900">{store.name}</h1>
          <p className="mt-2 text-sm text-neutral-500">
            Este catálogo digital se encuentra temporalmente inactivo. No es posible realizar pedidos en este momento.
          </p>
          {store.phone_whatsapp && (
            <div className="mt-6">
              <a
                href={`https://wa.me/${store.phone_whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
              >
                Contactar por WhatsApp
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Filter categories with at least one product
  const categoriesWithItems = categories.filter((c) => c.items.length > 0);

  // Extract catalog items preview for FloatingCartBar (only id, name, price, is_available)
  const catalogPreviews: CatalogItemPreview[] = [
    ...categoriesWithItems.flatMap((c) =>
      c.items.map((i) => ({
        id: i.id,
        name: i.name,
        price: Number(i.price),
        is_available: i.is_available,
      }))
    ),
    ...uncategorizedProducts.map((i) => ({
      id: i.id,
      name: i.name,
      price: Number(i.price),
      is_available: i.is_available,
    })),
  ];

  return (
    <div
      style={{ '--accent-rgb': hexToRgb(store.accent_color) } as React.CSSProperties}
      className="min-h-dvh bg-neutral-50 pb-[max(7rem,env(safe-area-inset-bottom))] text-neutral-900"
    >
      {/* Client Component: Single-mount hydration and slug initializer */}
      <CartHydration slug={slug} />

      {/* Server Component: Header with dynamic Lima Timezone Status */}
      <StoreHeader store={store} />

      {/* Server Component: Sticky Touch Navigation (only categories with products) */}
      {categoriesWithItems.length > 0 && <CategoryNav categories={categoriesWithItems} />}

      {/* Server Component: Grouped Product Grid */}
      <main className="mx-auto max-w-2xl px-4 pt-2">
        {categoriesWithItems.map((category) => (
          <section
            key={category.id}
            id={`category-${category.id}`}
            className="scroll-mt-14 pt-6 first:pt-4"
          >
            <h2 className="mb-3 text-lg font-extrabold tracking-tight text-neutral-900">
              {category.name}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {category.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        ))}

        {uncategorizedProducts.length > 0 && (
          <section className="scroll-mt-14 pt-6">
            <h2 className="mb-3 text-lg font-extrabold tracking-tight text-neutral-900">
              Otros productos
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {uncategorizedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Client Component: Floating Cart Bar receiving store & preview items */}
      <FloatingCartBar store={store} products={catalogPreviews} slug={slug} />
    </div>
  );
}
