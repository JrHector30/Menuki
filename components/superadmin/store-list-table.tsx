'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  type SuperadminStoreItem,
  toggleStoreActiveAction,
} from '@/app/actions/superadmin-actions';
import { CreateStoreDialog } from './create-store-dialog';
import { ResetPasswordDialog } from './reset-password-dialog';

interface StoreListTableProps {
  initialStores: SuperadminStoreItem[];
}

export function StoreListTable({ initialStores }: StoreListTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [togglingStoreId, setTogglingStoreId] = useState<string | null>(null);

  // Reset password modal state
  const [resetTarget, setResetTarget] = useState<{
    userId: string;
    email: string;
    storeName: string;
  } | null>(null);

  const filteredStores = initialStores.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.ownerEmail && s.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalStores = initialStores.length;
  const activeStores = initialStores.filter((s) => s.isActive).length;
  const suspendedStores = totalStores - activeStores;

  async function handleToggleActive(store: SuperadminStoreItem) {
    const nextState = !store.isActive;
    const confirmMessage = nextState
      ? `¿Reactivar la membresía de "${store.name}"? El catálogo volverá a estar disponible.`
      : `¿Suspender la membresía de "${store.name}"? El catálogo público quedará inactivo y se bloquearán nuevos pedidos.`;

    if (!confirm(confirmMessage)) return;

    setTogglingStoreId(store.id);
    try {
      const res = await toggleStoreActiveAction(store.id, nextState);
      if (!res.ok) {
        alert(res.error || 'Error al actualizar el estado de membresía.');
      } else {
        startTransition(() => {
          router.refresh();
        });
      }
    } catch {
      alert('Error de red al actualizar estado.');
    } finally {
      setTogglingStoreId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-neutral-500">Total de Locales</p>
          <p className="mt-1 text-2xl font-black text-neutral-900">{totalStores}</p>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600">Membresías Activas</p>
          <p className="mt-1 text-2xl font-black text-emerald-700">{activeStores}</p>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-amber-600">Membresías Suspendidas</p>
          <p className="mt-1 text-2xl font-black text-amber-700">{suspendedStores}</p>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, slug o correo..."
            className="w-full rounded-2xl border border-neutral-300 bg-white py-2.5 pl-9 pr-4 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900"
          />
          <svg
            className="absolute left-3 top-3 h-4 w-4 text-neutral-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800"
        >
          <span>+</span>
          <span>Dar de alta nuevo local</span>
        </button>
      </div>

      {/* Stores Table Container */}
      <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        {filteredStores.length === 0 ? (
          <div className="p-12 text-center text-neutral-500">
            <p className="text-sm font-semibold">No se encontraron locales.</p>
            <p className="mt-1 text-xs">Prueba con otro término de búsqueda o crea un nuevo local.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-700">
              <thead className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-5 py-3.5">Local / Slug</th>
                  <th className="px-5 py-3.5">Dueño</th>
                  <th className="px-5 py-3.5">Contacto</th>
                  <th className="px-5 py-3.5">Membresía</th>
                  <th className="px-5 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredStores.map((store) => (
                  <tr key={store.id} className="transition hover:bg-neutral-50/70">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: store.accentColor }}
                        />
                        <div>
                          <p className="font-bold text-neutral-900">{store.name}</p>
                          <Link
                            href={`/${store.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[11px] text-neutral-400 hover:text-neutral-900 hover:underline"
                          >
                            /{store.slug} ↗
                          </Link>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-medium text-neutral-800">
                        {store.ownerEmail ?? <span className="italic text-neutral-400">Sin dueño asignado</span>}
                      </p>
                      {store.ownerUserId && (
                        <button
                          type="button"
                          onClick={() =>
                            setResetTarget({
                              userId: store.ownerUserId!,
                              email: store.ownerEmail || 'Sin email',
                              storeName: store.name,
                            })
                          }
                          className="mt-0.5 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:underline"
                        >
                          Cambiar contraseña
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-4 font-mono text-[11px] text-neutral-600">
                      <div>WA: {store.phoneWhatsapp || '--'}</div>
                      {store.yapeNumber && <div className="text-neutral-400">Yape: {store.yapeNumber}</div>}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(store)}
                          disabled={togglingStoreId === store.id || isPending}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                            store.isActive
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          } disabled:opacity-50`}
                          title="Haz clic para cambiar el estado de la membresía"
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              store.isActive ? 'bg-emerald-600' : 'bg-amber-600'
                            }`}
                          />
                          {store.isActive ? 'Activa' : 'Suspendida'}
                        </button>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/${store.slug}/admin`}
                          className="inline-flex items-center gap-1 rounded-xl bg-neutral-900 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-neutral-800"
                        >
                          <span>Administrar local</span>
                          <span>↗</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Store Modal */}
      <CreateStoreDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onStoreCreated={() => {
          startTransition(() => {
            router.refresh();
          });
        }}
      />

      {/* Reset Password Modal */}
      {resetTarget && (
        <ResetPasswordDialog
          isOpen={!!resetTarget}
          onClose={() => setResetTarget(null)}
          userId={resetTarget.userId}
          userEmail={resetTarget.email}
          storeName={resetTarget.storeName}
        />
      )}
    </div>
  );
}
