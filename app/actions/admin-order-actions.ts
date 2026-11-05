'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireStoreMember } from '@/lib/auth/require-store-member';
import { rethrowIfRedirect } from '@/lib/auth/rethrow-if-redirect';
import type { Database } from '@/types/database';

export type OrderStatus = Database['public']['Enums']['order_status'];

export interface OrderActionResponse {
  ok: boolean;
  error?: string;
}

const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export async function updateOrderStatus(
  slug: string,
  orderId: string,
  nextStatus: OrderStatus
): Promise<OrderActionResponse> {
  try {
    const { store } = await requireStoreMember(slug);
    const supabase = await createClient();

    // 1. Fetch current status
    const { data: currentOrder, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .eq('store_id', store.id)
      .maybeSingle();

    if (fetchError || !currentOrder) {
      return { ok: false, error: 'Pedido no encontrado en este local.' };
    }

    // 2. Validate status transition
    const allowed = VALID_TRANSITIONS[currentOrder.status];
    if (!allowed.includes(nextStatus)) {
      return {
        ok: false,
        error: `Transición no permitida de "${currentOrder.status}" a "${nextStatus}".`,
      };
    }

    // 3. Update status conditioned strictly on .eq('status', currentOrder.status)
    const { data, error: updateError } = await supabase
      .from('orders')
      .update({ status: nextStatus })
      .eq('id', orderId)
      .eq('store_id', store.id)
      .eq('status', currentOrder.status)
      .select('id');

    if (updateError || !data || data.length === 0) {
      return { ok: false, error: 'El pedido cambió de estado; actualiza la lista.' };
    }

    revalidatePath(`/${slug}/admin/pedidos`);
    revalidatePath(`/${slug}/admin`);
    return { ok: true };
  } catch (err) {
    rethrowIfRedirect(err);
    return { ok: false, error: 'Ocurrió un error inesperado al actualizar el pedido.' };
  }
}
