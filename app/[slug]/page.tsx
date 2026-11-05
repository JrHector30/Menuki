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
