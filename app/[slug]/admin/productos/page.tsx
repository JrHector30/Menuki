import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { AdminProductTable } from '@/components/admin/admin-product-table';

interface AdminProductsPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminProductsPage({ params }: AdminProductsPageProps) {
  const { slug } = await params;
  const { store, role } = await requireStoreMember(slug);
  const supabase = await createClient();

  // Fetch products and categories subject to authenticated RLS
  const [categoriesRes, productsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products')
      .select('*')
      .eq('store_id', store.id)
      .order('name', { ascending: true }),
  ]);

  const categories = categoriesRes.data ?? [];
  const products = productsRes.data ?? [];

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div>
        <h1 className="text-xl font-black text-neutral-900">Carta y Productos</h1>
        <p className="text-xs text-neutral-500">
          Gestiona los precios, la disponibilidad inmediata y los detalles de los productos.
        </p>
      </div>

      <AdminProductTable
        slug={slug}
        storeId={store.id}
        role={role}
        initialProducts={products}
        categories={categories}
      />
    </div>
  );
}
