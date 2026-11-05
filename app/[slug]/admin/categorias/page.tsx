import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { CategoryManager } from '@/components/admin/category-manager';

interface AdminCategoriasPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminCategoriasPage({ params }: AdminCategoriasPageProps) {
  const { slug } = await params;
  const { store, role } = await requireStoreMember(slug);
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('store_id', store.id)
    .order('sort_order', { ascending: true });

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div>
        <h1 className="text-xl font-black text-neutral-900">Categorías</h1>
        <p className="text-xs text-neutral-500">
          Organiza y define el orden de presentación de las secciones del catálogo.
        </p>
      </div>

      <CategoryManager
        slug={slug}
        role={role}
        initialCategories={categories ?? []}
      />
    </div>
  );
}
