import { cache } from 'react';
import { supabasePublic } from '@/lib/supabase/public';
import type { Category, Product, Store, StoreOpeningHours, DaySchedule } from '@/types/domain';
import type { Json } from '@/types/database';

const VALID_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/**
 * Safely parses opening_hours JSON from the database.
 * If open or close are missing or invalid format, that day is omitted without fallback times.
 */
export function parseOpeningHours(rawHours: Json): StoreOpeningHours {
  if (!rawHours || typeof rawHours !== 'object' || Array.isArray(rawHours)) {
    return {};
  }

  const result: StoreOpeningHours = {};
  const record = rawHours as Record<string, unknown>;

  for (const day of VALID_DAYS) {
    const val = record[day];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      const scheduleObj = val as Record<string, unknown>;
      const isOpenValid = typeof scheduleObj.open === 'string' && /^\d{2}:\d{2}$/.test(scheduleObj.open);
      const isCloseValid = typeof scheduleObj.close === 'string' && /^\d{2}:\d{2}$/.test(scheduleObj.close);
      const isClosedBool = typeof scheduleObj.closed === 'boolean';

      // Only assign if schedule fields are strictly valid
      if (isOpenValid && isCloseValid) {
        result[day] = {
          open: scheduleObj.open as string,
          close: scheduleObj.close as string,
          closed: isClosedBool ? (scheduleObj.closed as boolean) : false,
        } as DaySchedule;
      }
    }
  }

  return result;
}

export interface StoreCatalogData {
  store: Store;
  categories: (Category & { items: Product[] })[];
  uncategorizedProducts: Product[];
}

/**
 * Server-only fetcher wrapped in React cache() to deduplicate requests across generateMetadata and page render.
 * Uses maybeSingle() and throws an error if any database query fails.
 * Returns null ONLY if the store slug does not exist.
 */
export const getStoreCatalog = cache(async (slug: string): Promise<StoreCatalogData | null> => {
  // 1. Fetch store by slug
  const { data: storeRow, error: storeError } = await supabasePublic
    .from('stores')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (storeError) {
    throw new Error(`Error al consultar la tienda con slug "${slug}": ${storeError.message}`);
  }

  if (!storeRow) {
    return null;
  }

  // 2. Fetch categories and products concurrently
  const [categoriesRes, productsRes] = await Promise.all([
    supabasePublic
      .from('categories')
      .select('*')
      .eq('store_id', storeRow.id)
      .order('sort_order', { ascending: true }),
    supabasePublic
      .from('products')
      .select('*')
      .eq('store_id', storeRow.id)
      .order('name', { ascending: true }),
  ]);

  if (categoriesRes.error) {
    throw new Error(
      `Error al consultar las categorías de la tienda "${slug}": ${categoriesRes.error.message}`
    );
  }

  if (productsRes.error) {
    throw new Error(
      `Error al consultar los productos de la tienda "${slug}": ${productsRes.error.message}`
    );
  }

  const rawCategories = categoriesRes.data;
  const rawProducts = productsRes.data;

  const store: Store = {
    ...storeRow,
    opening_hours: parseOpeningHours(storeRow.opening_hours),
  };

  const categories = rawCategories.map((category) => ({
    ...category,
    items: rawProducts.filter((product) => product.category_id === category.id),
  }));

  const uncategorizedProducts = rawProducts.filter((product) => !product.category_id);

  return {
    store,
    categories,
    uncategorizedProducts,
  };
});
