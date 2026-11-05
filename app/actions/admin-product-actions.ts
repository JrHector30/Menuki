'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { rethrowIfRedirect } from '@/lib/auth/rethrow-if-redirect';

export interface ActionResponse {
  ok: boolean;
  error?: string;
}

export async function toggleProductAvailability(
  slug: string,
  productId: string,
  isAvailable: boolean
): Promise<ActionResponse> {
  try {
    const { store } = await requireStoreMember(slug);
    const supabase = await createClient();

    // RLS will ensure user has update permission for their own store's product
    const { data, error } = await supabase
      .from('products')
      .update({
        is_available: isAvailable,
      })
      .eq('id', productId)
      .eq('store_id', store.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return { ok: false, error: 'No se pudo actualizar la disponibilidad del producto.' };
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin/productos`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Ocurrió un error inesperado al modificar el producto.' };
  }
}

// Zod validation for image URL: only https and only hostname from NEXT_PUBLIC_SUPABASE_URL
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let allowedHostname: string | null = null;
try {
  if (supabaseUrl) {
    allowedHostname = new URL(supabaseUrl).hostname;
  }
} catch {
  // invalid env URL fallback
}

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80, 'Máximo 80 caracteres'),
  price: z.coerce
    .number()
    .min(0, 'El precio no puede ser negativo')
    .max(9999.99, 'El precio máximo es 9999.99')
    .refine((val) => Number(val.toFixed(2)) === val, 'Máximo 2 decimales permitidos'),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().max(300, 'Máximo 300 caracteres').nullable().optional(),
  imageUrl: z
    .string()
    .url('Debe ser una URL válida')
    .refine((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') return false;
        if (allowedHostname && parsed.hostname !== allowedHostname) return false;
        return true;
      } catch {
        return false;
      }
    }, `La imagen debe estar alojada de forma segura en https://${allowedHostname || 'supabase'}`)
    .or(z.literal(''))
    .nullable()
    .optional(),
  isAvailable: z.boolean().default(true),
});

export async function upsertProduct(
  slug: string,
  formData: z.infer<typeof productSchema>
): Promise<ActionResponse> {
  const parsed = productSchema.safeParse(formData);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Datos de producto inválidos';
    return { ok: false, error: msg };
  }

  const values = parsed.data;

  try {
    const { store } = await requireStoreMember(slug);
    const supabase = await createClient();

    // If category is provided, verify it belongs to the store
    if (values.categoryId) {
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('id', values.categoryId)
        .eq('store_id', store.id)
        .maybeSingle();

      if (!cat) {
        return { ok: false, error: 'La categoría seleccionada no pertenece a esta tienda.' };
      }
    }

    if (values.id) {
      // Update existing (updated_at is handled by DB trigger)
      const { data, error } = await supabase
        .from('products')
        .update({
          category_id: values.categoryId || null,
          name: values.name,
          price: values.price,
          description: values.description || null,
          image_url: values.imageUrl || null,
          is_available: values.isAvailable,
        })
        .eq('id', values.id)
        .eq('store_id', store.id)
        .select('id');

      if (error || !data || data.length === 0) {
        return { ok: false, error: 'No se pudo guardar la información del producto.' };
      }
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('products')
        .insert({
          store_id: store.id,
          category_id: values.categoryId || null,
          name: values.name,
          price: values.price,
          description: values.description || null,
          image_url: values.imageUrl || null,
          is_available: values.isAvailable,
        })
        .select('id');

      if (error || !data || data.length === 0) {
        return { ok: false, error: 'No se pudo crear el producto.' };
      }
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin/productos`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Error inesperado al guardar el producto.' };
  }
}

export async function deleteProduct(slug: string, productId: string): Promise<ActionResponse> {
  try {
    const { store, role } = await requireStoreMember(slug);
    if (role === 'staff') {
      return { ok: false, error: 'Solo los administradores o dueños pueden eliminar productos.' };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .eq('store_id', store.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return { ok: false, error: 'No se pudo eliminar el producto o no tienes permisos.' };
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin/productos`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Error inesperado al eliminar el producto.' };
  }
}

/* ---------------- CATEGORIES CRUD ---------------- */

const categorySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(50, 'Máximo 50 caracteres'),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export async function createCategory(
  slug: string,
  name: string,
  sortOrder: number
): Promise<ActionResponse> {
  const parsed = categorySchema.safeParse({ name, sortOrder });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Nombre de categoría inválido.' };
  }

  try {
    const { store } = await requireStoreMember(slug);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .insert({
        store_id: store.id,
        name: parsed.data.name,
        sort_order: parsed.data.sortOrder,
      })
      .select('id');

    if (error || !data || data.length === 0) {
      return { ok: false, error: 'No se pudo registrar la categoría.' };
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin/categorias`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Error inesperado al crear la categoría.' };
  }
}

export async function updateCategory(
  slug: string,
  categoryId: string,
  name: string,
  sortOrder: number
): Promise<ActionResponse> {
  const parsed = categorySchema.safeParse({ name, sortOrder });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Datos de categoría inválidos.' };
  }

  try {
    const { store } = await requireStoreMember(slug);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: parsed.data.name,
        sort_order: parsed.data.sortOrder,
      })
      .eq('id', categoryId)
      .eq('store_id', store.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return { ok: false, error: 'No se pudo actualizar la categoría.' };
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin/categorias`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Error inesperado al modificar la categoría.' };
  }
}

export async function deleteCategory(slug: string, categoryId: string): Promise<ActionResponse> {
  try {
    const { store, role } = await requireStoreMember(slug);
    if (role === 'staff') {
      return { ok: false, error: 'Solo los administradores o dueños pueden eliminar categorías.' };
    }

    const supabase = await createClient();

    // Check if category has products
    const { count } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('category_id', categoryId)
      .eq('store_id', store.id);

    if (count && count > 0) {
      return {
        ok: false,
        error: `No puedes eliminar esta categoría porque tiene ${count} producto(s) asignado(s).`,
      };
    }

    const { data, error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId)
      .eq('store_id', store.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return { ok: false, error: 'No se pudo eliminar la categoría.' };
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin/categorias`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Error inesperado al eliminar la categoría.' };
  }
}
