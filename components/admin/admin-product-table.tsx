'use client';

import { useState, useTransition, useOptimistic } from 'react';
import Image from 'next/image';
import type { Product, Category } from '@/types/domain';
import type { StoreRole } from '@/lib/auth/require-store-member';
import { formatCurrency } from '@/lib/utils/currency';
import {
  toggleProductAvailability,
  deleteProduct,
} from '@/app/actions/admin-product-actions';
import { deleteStoreAsset } from '@/lib/storage/upload-image';
import { ProductDialog } from './product-dialog';

interface AdminProductTableProps {
  slug: string;
  storeId: string;
  role: StoreRole;
  initialProducts: Product[];
  categories: Category[];
}

type OptimisticAction =
  | { type: 'toggle'; productId: string; isAvailable: boolean }
  | { type: 'delete'; productId: string };

export function AdminProductTable({
  slug,
  storeId,
  role,
  initialProducts,
  categories,
}: AdminProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Optimistic Products via useOptimistic (React 19)
  const [optimisticProducts, setOptimisticProducts] = useOptimistic(
    initialProducts,
    (currentProducts: Product[], action: OptimisticAction) => {
      switch (action.type) {
        case 'toggle':
          return currentProducts.map((p) =>
            p.id === action.productId ? { ...p, is_available: action.isAvailable } : p
          );
        case 'delete':
          return currentProducts.filter((p) => p.id !== action.productId);
        default:
          return currentProducts;
      }
    }
  );

  function handleToggle(product: Product) {
    if (processingId) return;

    const nextStatus = !product.is_available;
    setErrorMessage(null);
    setProcessingId(product.id);

    startTransition(async () => {
      setOptimisticProducts({
        type: 'toggle',
        productId: product.id,
        isAvailable: nextStatus,
      });

      const res = await toggleProductAvailability(slug, product.id, nextStatus);
      if (!res.ok) {
        setErrorMessage(res.error || 'No se pudo actualizar el producto.');
      }
      setProcessingId(null);
    });
  }

  function handleDelete(product: Product) {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${product.name}"?`)) {
      return;
    }

    setProcessingId(product.id);
    startTransition(async () => {
      setOptimisticProducts({
        type: 'delete',
        productId: product.id,
      });

      const res = await deleteProduct(slug, product.id);
      if (!res.ok) {
        setErrorMessage(res.error || 'No se pudo eliminar el producto.');
      } else {
        if (product.image_url) {
          deleteStoreAsset(product.image_url);
        }
      }
      setProcessingId(null);
    });
  }

  const isStaff = role === 'staff';

  const filteredProducts = optimisticProducts.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Group by category
  const categoryMap = new Map<string, { category: Category | null; products: Product[] }>();
  categories.forEach((cat) => {
    categoryMap.set(cat.id, { category: cat, products: [] });
  });
  categoryMap.set('uncategorized', { category: null, products: [] });

  filteredProducts.forEach((p) => {
    const key = p.category_id && categoryMap.has(p.category_id) ? p.category_id : 'uncategorized';
    categoryMap.get(key)!.products.push(p);
  });

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

      {/* Action Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <label htmlFor="search-products" className="sr-only">
            Buscar producto
          </label>
          <input
            id="search-products"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar producto por nombre..."
            className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setIsDialogOpen(true);
          }}
          className="flex min-h-[44px] items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-neutral-800 active:scale-[0.99]"
        >
          + Nuevo Producto
        </button>
      </div>

      {/* Category Groups */}
      {Array.from(categoryMap.values()).map(({ category, products: groupProducts }) => {
        if (groupProducts.length === 0) return null;

        return (
          <div key={category ? category.id : 'uncategorized'} className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
              {category ? category.name : 'Sin categoría'} ({groupProducts.length})
            </h3>

            {/* Desktop Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm md:block">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-neutral-100 bg-neutral-50 font-bold text-neutral-600">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3">Precio</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {groupProducts.map((p) => {
                    const isRowBusy = processingId === p.id;
                    return (
                      <tr
                        key={p.id}
                        className={`transition hover:bg-neutral-50/50 ${
                          isRowBusy ? 'opacity-50 pointer-events-none' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                              {p.image_url ? (
                                <Image
                                  src={p.image_url}
                                  alt={p.name}
                                  fill
                                  sizes="40px"
                                  className="object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                                  Sin foto
                                </div>
                              )}
                            </div>
                            <div>
                              <span className="font-bold text-neutral-900">{p.name}</span>
                              {p.description && (
                                <p className="line-clamp-1 max-w-xs text-neutral-500">
                                  {p.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-semibold text-neutral-900">
                          {formatCurrency(p.price)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggle(p)}
                            disabled={isRowBusy}
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                              p.is_available
                                ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                p.is_available ? 'bg-emerald-500' : 'bg-neutral-400'
                              }`}
                            />
                            {p.is_available ? 'Disponible' : 'Agotado'}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setEditingProduct(p);
                                setIsDialogOpen(true);
                              }}
                              className="rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold text-neutral-700 transition hover:bg-neutral-100"
                            >
                              Editar
                            </button>
                            {!isStaff && (
                              <button
                                onClick={() => handleDelete(p)}
                                className="rounded-lg border border-neutral-200 px-3 py-1.5 font-semibold text-rose-600 transition hover:bg-rose-50"
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {groupProducts.map((p) => {
                const isRowBusy = processingId === p.id;
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition ${
                      isRowBusy ? 'opacity-50 pointer-events-none' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl bg-neutral-100">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                            Sin foto
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-neutral-900">{p.name}</h4>
                          <span className="font-bold text-neutral-900">
                            {formatCurrency(p.price)}
                          </span>
                        </div>
                        {p.description && (
                          <p className="mt-1 line-clamp-2 text-xs text-neutral-500">
                            {p.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(p)}
                        disabled={isRowBusy}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                          p.is_available
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-neutral-100 text-neutral-500'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            p.is_available ? 'bg-emerald-500' : 'bg-neutral-400'
                          }`}
                        />
                        {p.is_available ? 'Disponible' : 'Agotado'}
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setIsDialogOpen(true);
                          }}
                          className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 active:bg-neutral-200"
                        >
                          Editar
                        </button>
                        {!isStaff && (
                          <button
                            onClick={() => handleDelete(p)}
                            className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 active:bg-rose-100"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Product Create/Edit Dialog */}
      <ProductDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        slug={slug}
        storeId={storeId}
        categories={categories}
        product={editingProduct}
      />
    </div>
  );
}
