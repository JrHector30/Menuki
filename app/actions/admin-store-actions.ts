'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { rethrowIfRedirect } from '@/lib/auth/rethrow-if-redirect';
import { normalizePeruvianPhone } from '@/lib/whatsapp/build-whatsapp-url';
import type { Json } from '@/types/database';

export interface StoreConfigActionResponse {
  ok: boolean;
  error?: string;
}

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const dailyHoursSchema = z
  .object({
    open: z.string().regex(timeRegex, 'Formato de hora HH:MM inválido'),
    close: z.string().regex(timeRegex, 'Formato de hora HH:MM inválido'),
    closed: z.boolean().default(false),
  })
  .nullable();

const openingHoursSchema = z.object({
  monday: dailyHoursSchema.optional(),
  tuesday: dailyHoursSchema.optional(),
  wednesday: dailyHoursSchema.optional(),
  thursday: dailyHoursSchema.optional(),
  friday: dailyHoursSchema.optional(),
  saturday: dailyHoursSchema.optional(),
  sunday: dailyHoursSchema.optional(),
});

const storeConfigSchema = z.object({
  phoneWhatsApp: z.string().min(9, 'El teléfono debe tener 9 dígitos').max(15),
  yapeNumber: z.string().max(15).nullable().optional(),
  plinNumber: z.string().max(15).nullable().optional(),
  logoUrl: z.string().url().or(z.literal('')).nullable().optional(),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'El color debe ser un código hexadecimal válido (ej. #E11D48)'),
  isOpenManual: z.boolean(),
  openingHours: openingHoursSchema,
});

export async function updateStoreConfig(
  slug: string,
  formData: z.infer<typeof storeConfigSchema>
): Promise<StoreConfigActionResponse> {
  const parsed = storeConfigSchema.safeParse(formData);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message || 'Datos de configuración inválidos.',
    };
  }

  try {
    const { store, role } = await requireStoreMember(slug);

    if (role !== 'owner' && role !== 'admin') {
      return {
        ok: false,
        error: 'Solo los administradores y dueños pueden modificar la configuración de la tienda.',
      };
    }

    const {
      phoneWhatsApp,
      yapeNumber,
      plinNumber,
      logoUrl,
      accentColor,
      isOpenManual,
      openingHours,
    } = parsed.data;

    // 1. Validate normalized WhatsApp: must be 519XXXXXXXX (51 + 9 digits starting with 9)
    const normalizedWhatsApp = normalizePeruvianPhone(phoneWhatsApp);
    if (!/^519\d{8}$/.test(normalizedWhatsApp)) {
      return {
        ok: false,
        error: 'El WhatsApp debe ser un número celular peruano válido (9 dígitos comenzando con 9).',
      };
    }

    // 2. Validate Yape/Plin (optional, but if provided must be 9 digits starting with 9)
    let normalizedYape: string | null = null;
    if (yapeNumber && yapeNumber.trim()) {
      const digits = yapeNumber.replace(/\D/g, '');
      if (!/^9\d{8}$/.test(digits)) {
        return {
          ok: false,
          error: 'El número de Yape debe ser un número celular peruano de 9 dígitos que comience con 9.',
        };
      }
      normalizedYape = digits;
    }

    let normalizedPlin: string | null = null;
    if (plinNumber && plinNumber.trim()) {
      const digits = plinNumber.replace(/\D/g, '');
      if (!/^9\d{8}$/.test(digits)) {
        return {
          ok: false,
          error: 'El número de Plin debe ser un número celular peruano de 9 dígitos que comience con 9.',
        };
      }
      normalizedPlin = digits;
    }

    // 3. Validate logoUrl: must be empty/null OR have the exact prefix of the store bucket
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (logoUrl && logoUrl.trim()) {
      const allowedLogoPrefix = `${supabaseUrl}/storage/v1/object/public/store-assets/${store.id}/`;
      if (!logoUrl.startsWith(allowedLogoPrefix)) {
        return {
          ok: false,
          error: 'El logo debe estar alojado en la carpeta de este local en el almacenamiento.',
        };
      }
    }

    const supabase = await createClient();

    // RLS and column-level grant strictly protect id and slug. updated_at is handled by DB trigger.
    const { data, error } = await supabase
      .from('stores')
      .update({
        phone_whatsapp: normalizedWhatsApp,
        yape_number: normalizedYape,
        plin_number: normalizedPlin,
        logo_url: logoUrl || null,
        accent_color: accentColor.toUpperCase(),
        is_open_manual: isOpenManual,
        opening_hours: openingHours as unknown as Json,
      })
      .eq('id', store.id)
      .select('id');

    if (error || !data || data.length === 0) {
      return { ok: false, error: 'No se pudo actualizar la configuración en la base de datos.' };
    }

    revalidatePath(`/${slug}`);
    revalidatePath(`/${slug}/admin`);
    revalidatePath(`/${slug}/admin/configuracion`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Ocurrió un error inesperado al guardar la configuración.' };
  }
}
