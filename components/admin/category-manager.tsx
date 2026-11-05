'use client';

import { useState, useTransition, useOptimistic } from 'react';
import type { Category } from '@/types/domain';
import type { StoreRole } from '@/lib/auth/require-store-member';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/app/actions/admin-product-actions';

interface CategoryManagerProps {
  slug: string;
  role: StoreRole;
  initialCategories: Category[];
}

type OptimisticCategoryAction =
  | { type: 'delete'; categoryId: string }
  | { type: 'reorder'; fromIndex: number; toIndex: number };

export function CategoryManager({
  slug,
  role,
  initialCategories,
}: CategoryManagerProps) {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [optimisticCategories, setOptimisticCategories] = useOptimistic(
    initialCategories,
    (current: Category[], action: OptimisticCategoryAction) => {
      switch (action.type) {
        case 'delete':
          return current.filter((c) => c.id !== action.categoryId);
        case 'reorder': {
          const next = [...current];
          const [moved] = next.splice(action.fromIndex, 1);
          next.splice(action.toIndex, 0, moved);
          return next;
        }
        default:
          return current;
      }
    }
  );

  const isStaff = role === 'staff';

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setErrorMessage(null);
    const nextOrder =
      optimisticCategories.length > 0
        ? Math.max(...optimisticCategories.map((c) => c.sort_order)) + 1
        : 0;

    startTransition(async () => {
      const res = await createCategory(slug, newCategoryName.trim(), nextOrder);
      if (!res.ok) {
        setErrorMessage(res.error || 'No se pudo crear la categoría.');
      } else {
        setNewCategoryName('');
      }
    });
  }

  function handleSaveRename(category: Category) {
    if (!editingName.trim()) return;

    setErrorMessage(null);
    startTransition(async () => {
      const res = await updateCategory(slug, category.id, editingName.trim(), category.sort_order);
      if (!res.ok) {
        setErrorMessage(res.error || 'No se pudo renombrar la categoría.');
      } else {
        setEditingId(null);
      }
    });
  }

  function handleMove(index: number, direction: 'up' | 'down') {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= optimisticCategories.length) return;

    const currentCat = optimisticCategories[index];
    const targetCat = optimisticCategories[targetIndex];

    const newCurrentOrder = targetCat.sort_order;
    const newTargetOrder = currentCat.sort_order;

    setErrorMessage(null);
    startTransition(async () => {
      setOptimisticCategories({
        type: 'reorder',
        fromIndex: index,
        toIndex: targetIndex,
      });

      const [res1, res2] = await Promise.all([
        updateCategory(slug, currentCat.id, currentCat.name, newCurrentOrder),
        updateCategory(slug, targetCat.id, targetCat.name, newTargetOrder),
      ]);

      if (!res1.ok || !res2.ok) {
        setErrorMessage('No se pudo reordenar las categorías.');
      }
    });
  }

  function handleDelete(category: Category) {
    if (!window.confirm(`¿Seguro que deseas eliminar la categoría "${category.name}"?`)) {
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      setOptimisticCategories({
        type: 'delete',
        categoryId: category.id,
      });

      const res = await deleteCategory(slug, category.id);
      if (!res.ok) {
        setErrorMessage(res.error || 'No se pudo eliminar la categoría.');
      }
    });
  }

  return (
    <div className="space-y-6">
      {errorMessage && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="rounded px-2 py-1 hover:bg-rose-100"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="flex gap-2">
        <label htmlFor="new-category-name" className="sr-only">
          Nombre de la categoría
        </label>
        <input
          id="new-category-name"
          type="text"
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="Nombre de la nueva categoría..."
          className="min-h-[44px] flex-1 rounded-xl border border-neutral-300 bg-white px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
        <button
          type="submit"
          disabled={isPending || !newCategoryName.trim()}
          className="min-h-[44px] rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
        >
          + Agregar
        </button>
      </form>

      {/* Category List */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {optimisticCategories.length === 0 ? (
          <div className="p-8 text-center text-xs text-neutral-500">
            No tienes categorías registradas aún.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {optimisticCategories.map((cat, idx) => (
              <li
                key={cat.id}
                className="flex items-center justify-between gap-4 p-4 transition hover:bg-neutral-50/50"
              >
                <div className="flex flex-1 items-center gap-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'up')}
                      disabled={idx === 0 || isPending}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-20"
                      title="Mover arriba"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(idx, 'down')}
                      disabled={idx === optimisticCategories.length - 1 || isPending}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-20"
                      title="Mover abajo"
                    >
                      ▼
                    </button>
                  </div>

                  {editingId === cat.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <label htmlFor={`rename-cat-${cat.id}`} className="sr-only">
                        Editar nombre
                      </label>
                      <input
                        id={`rename-cat-${cat.id}`}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="min-h-[36px] flex-1 rounded-lg border border-neutral-300 px-2.5 text-xs outline-none focus:border-neutral-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveRename(cat)}
                        className="rounded-lg bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div>
                      <span className="text-sm font-bold text-neutral-900">{cat.name}</span>
                      <span className="ml-2 text-[11px] text-neutral-400">
                        (orden: {cat.sort_order})
                      </span>
                    </div>
                  )}
                </div>

                {editingId !== cat.id && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(cat.id);
                        setEditingName(cat.name);
                      }}
                      className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                    >
                      Renombrar
                    </button>
                    {!isStaff && (
                      <button
                        type="button"
                        onClick={() => handleDelete(cat)}
                        className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
