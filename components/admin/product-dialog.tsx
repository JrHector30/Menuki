'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import type { Product, Category } from '@/types/domain';
import { upsertProduct } from '@/app/actions/admin-product-actions';

interface ProductDialogProps {
  isOpen: boolean;
  onClose: () => void;
  slug: string;
  storeId: string;
  categories: Category[];
  product?: Product | null;
}

export function ProductDialog({
  isOpen,
  onClose,
  slug,
  storeId,
  categories,
  product,
}: ProductDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      setError(null);
      setImageUrl(product?.image_url || null);
      setImagePreview(product?.image_url || null);
      setSelectedFile(null);
      setOpenCount((prev) => prev + 1);

      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen, product]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato no válido. Usa JPG, PNG o WebP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('El archivo excede el límite máximo de 2 MB.');
      return;
    }

    setError(null);
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    const name = (formData.get('name') as string)?.trim();
    const price = parseFloat(formData.get('price') as string);
    const categoryId = (formData.get('categoryId') as string) || null;
    const description = (formData.get('description') as string)?.trim() || null;
    const isAvailable = formData.get('isAvailable') === 'on';

    startTransition(async () => {
      let uploadedUrl: string | null = null;

      // 1. Order: Dynamic import of storage helper only when uploading a file
      if (selectedFile) {
        try {
          setIsUploading(true);
          const { uploadStoreAsset } = await import('@/lib/storage/upload-image');
          uploadedUrl = await uploadStoreAsset(storeId, selectedFile);
        } catch (uploadErr: unknown) {
          setIsUploading(false);
          const errObj = uploadErr as Error;
          setError(errObj.message || 'Error al procesar y subir la imagen.');
          return;
        } finally {
          setIsUploading(false);
        }
      }

      const finalImageUrl = uploadedUrl ?? imageUrl;

      // 2. Save product in database
      const res = await upsertProduct(slug, {
        id: product?.id,
        name,
        price,
        categoryId,
        description,
        imageUrl: finalImageUrl,
        isAvailable,
      });

      if (!res.ok) {
        // If product saving fails, rollback: delete the newly uploaded image!
        if (uploadedUrl) {
          const { deleteStoreAsset } = await import('@/lib/storage/upload-image');
          await deleteStoreAsset(uploadedUrl);
        }
        setError(res.error || 'No se pudo guardar el producto.');
      } else {
        // If saving succeeded, clean up previous image
        if (uploadedUrl && product?.image_url && product.image_url !== uploadedUrl) {
          const { deleteStoreAsset } = await import('@/lib/storage/upload-image');
          await deleteStoreAsset(product.image_url);
        }
        onClose();
      }
    });
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-auto w-full max-w-lg rounded-3xl bg-white p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
        <h2 className="text-base font-bold text-neutral-900">
          {product ? 'Editar Producto' : 'Nuevo Producto'}
        </h2>
        <button
          onClick={onClose}
          type="button"
          className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Cerrar modal"
        >
          ✕
        </button>
      </div>

      <form
        key={`${product?.id ?? 'new'}-${openCount}`}
        onSubmit={handleSubmit}
        className="space-y-4 px-6 py-5"
      >
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="product-name" className="mb-1 block text-xs font-semibold text-neutral-700">
            Nombre del producto *
          </label>
          <input
            id="product-name"
            type="text"
            name="name"
            required
            defaultValue={product?.name || ''}
            placeholder="Ej: Café Americano Doble"
            className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="product-price" className="mb-1 block text-xs font-semibold text-neutral-700">
              Precio (S/) *
            </label>
            <input
              id="product-price"
              type="number"
              step="0.01"
              min="0"
              max="9999.99"
              name="price"
              required
              defaultValue={product ? product.price : ''}
              placeholder="0.00"
              className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          <div>
            <label htmlFor="product-category" className="mb-1 block text-xs font-semibold text-neutral-700">
              Categoría
            </label>
            <select
              id="product-category"
              name="categoryId"
              defaultValue={product?.category_id || ''}
              className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="product-description" className="mb-1 block text-xs font-semibold text-neutral-700">
            Descripción (opcional)
          </label>
          <textarea
            id="product-description"
            name="description"
            rows={2}
            maxLength={300}
            defaultValue={product?.description || ''}
            placeholder="Ingredientes o detalles breves del plato..."
            className="w-full rounded-xl border border-neutral-300 p-3 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
          />
        </div>

        {/* Image File Selector with Canvas WebP Preview */}
        <div>
          <label htmlFor="product-image-file" className="mb-1 block text-xs font-semibold text-neutral-700">
            Foto del producto (máx. 2 MB, JPG/PNG/WebP)
          </label>
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100">
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Vista previa"
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-neutral-400">
                  Sin foto
                </div>
              )}
            </div>
            <div className="flex-1">
              <input
                id="product-image-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="block w-full text-xs text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200"
              />
              <p className="mt-1 text-[11px] text-neutral-400">
                Se redimensiona a 800px WebP automáticamente antes de subir.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="product-is-available"
            name="isAvailable"
            defaultChecked={product ? product.is_available : true}
            className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
          />
          <label htmlFor="product-is-available" className="text-xs font-semibold text-neutral-700">
            Disponible para venta inmediata
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-neutral-200 px-4 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending || isUploading}
            className="min-h-[44px] rounded-xl bg-neutral-900 px-5 text-xs font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {isUploading ? 'Procesando imagen...' : isPending ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
