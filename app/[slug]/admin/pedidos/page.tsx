import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { OrdersManager } from '@/components/admin/orders-manager';

interface AdminOrdersPageProps {
  params: Promise<{ slug: string }>;
}

export default async function AdminOrdersPage({ params }: AdminOrdersPageProps) {
  const { slug } = await params;
  const { store } = await requireStoreMember(slug);
  const supabase = await createClient();

  // Fetch last 50 orders
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6 pb-20 sm:pb-6">
      <div>
        <h1 className="text-xl font-black text-neutral-900">Control de Pedidos</h1>
        <p className="text-xs text-neutral-500">
          Últimos 50 pedidos registrados. Se actualiza automáticamente cada 30 segundos.
        </p>
      </div>

      <OrdersManager slug={slug} orders={orders ?? []} />
    </div>
  );
}
