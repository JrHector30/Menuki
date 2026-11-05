import { requireSuperadmin } from '@/lib/auth/require-superadmin';
import { getAllStoresAction } from '@/app/actions/superadmin-actions';
import { StoreListTable } from '@/components/superadmin/store-list-table';

export const dynamic = 'force-dynamic';

export default async function SuperadminPage() {
  await requireSuperadmin();

  const res = await getAllStoresAction();
  const stores = res.ok && res.data ? res.data.stores : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
          Panel de Control de Locales
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-neutral-500">
          Gestiona las membresías, credenciales y el acceso a cada catálogo registrado en Menuki.
        </p>
      </div>

      {!res.ok && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {res.error || 'No se pudieron cargar los locales en este momento.'}
        </div>
      )}

      <StoreListTable initialStores={stores} />
    </div>
  );
}
