'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { orderIpLimiter, orderStoreLimiter } from '@/lib/rate-limit/rate-limiter';
import type { DeliveryType, OrderItemSnapshot, PaymentMethod } from '@/types/domain';

const orderItemInputSchema = z.object({
  product_id: z.string().uuid('ID de producto inválido'),
  qty: z
    .number()
    .int('La cantidad debe ser un número entero')
    .min(1, 'La cantidad mínima es 1')
    .max(99, 'La cantidad máxima es 99'),
});

const placeOrderSchema = z
  .object({
    store_id: z.string().uuid('ID de tienda inválido'),
    customer_name: z
      .string()
      .trim()
      .min(2, 'El nombre debe tener entre 2 y 80 caracteres')
      .max(80, 'El nombre no puede exceder 80 caracteres'),
    customer_phone: z
      .string()
      .trim()
      .min(6, 'El teléfono debe tener entre 6 y 20 caracteres')
      .max(20, 'El teléfono no puede exceder 20 caracteres'),
    delivery_type: z.enum(['delivery', 'pickup', 'dine_in']),
    address: z.string().trim().max(200, 'La dirección no puede exceder 200 caracteres').optional().nullable(),
    payment_method: z.enum(['cash', 'yape', 'plin', 'card']),
    items: z
      .array(orderItemInputSchema)
      .min(1, 'El pedido debe contener al menos 1 producto')
      .max(50, 'El pedido no puede exceder 50 productos'),
    client_request_id: z.string().uuid().optional().nullable(),
    honeypot: z.string().max(0, 'Spam detectado').optional(),
  })
  .refine(
    (data) => {
      if (data.delivery_type === 'delivery') {
        return !!data.address && data.address.trim().length >= 3;
      }
      return true;
    },
    {
      message: 'Ingresa tu dirección y referencia clara para el delivery',
      path: ['address'],
    }
  );

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

export type PlaceOrderResponse =
  | { ok: true; orderId: string; total: number; items: OrderItemSnapshot[] }
  | {
      ok: false;
      kind: 'validation' | 'business' | 'server';
      error: string;
      fieldErrors?: Record<string, string>;
    };

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResponse> {
  // 1. Zod validation
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field && typeof field === 'string' && !fieldErrors[field]) {
        fieldErrors[field] = issue.message;
      }
    }

    return {
      ok: false,
      kind: 'validation',
      error: parsed.error.issues[0]?.message || 'Verifica los datos del pedido',
      fieldErrors,
    };
  }

  // Honeypot anti-spam check
  if (parsed.data.honeypot) {
    return {
      ok: false,
      kind: 'validation',
      error: 'Solicitud no permitida',
    };
  }

  const {
    store_id,
    customer_name,
    customer_phone,
    delivery_type,
    address,
    payment_method,
    items,
    client_request_id,
  } = parsed.data;

  // 2. Rate Limiting (by IP and by store)
  const reqHeaders = await headers();
  const clientIp =
    reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    reqHeaders.get('x-real-ip') ||
    '127.0.0.1';

  const [ipLimit, storeLimit] = await Promise.all([
    orderIpLimiter.limit(clientIp),
    orderStoreLimiter.limit(store_id),
  ]);

  if (!ipLimit.success) {
    return {
      ok: false,
      kind: 'business',
      error: 'Has enviado demasiados pedidos en poco tiempo. Por favor espera unos minutos.',
    };
  }

  if (!storeLimit.success) {
    return {
      ok: false,
      kind: 'business',
      error: 'El local está recibiendo un alto volumen de pedidos en este momento. Intenta nuevamente en 1 minuto.',
    };
  }

  try {
    const supabaseAdmin = createAdminClient();

    // 3. Verify store is open
    const { data: store, error: storeError } = await supabaseAdmin
      .from('stores')
      .select('is_open_manual')
      .eq('id', store_id)
      .maybeSingle();

    if (storeError || !store) {
      return {
        ok: false,
        kind: 'business',
        error: 'El local solicitado no se encuentra disponible.',
      };
    }

    if (!store.is_open_manual) {
      return {
        ok: false,
        kind: 'business',
        error: 'El local se encuentra cerrado temporalmente para nuevos pedidos.',
      };
    }

    // 4. Execute create_order_secure RPC via admin client (idempotent with p_client_request_id)
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('create_order_secure', {
      p_store_id: store_id,
      p_customer_name: customer_name,
      p_customer_phone: customer_phone,
      p_delivery_type: delivery_type as DeliveryType,
      p_address: delivery_type === 'delivery' ? (address ?? null) : null,
      p_payment_method: payment_method as PaymentMethod,
      p_items: items,
      p_client_request_id: client_request_id || null,
    } as any);

    if (rpcError) {
      // Code P0001 is standard Postgres RAISE EXCEPTION (controlled business rule)
      if (rpcError.code === 'P0001') {
        return {
          ok: false,
          kind: 'business',
          error: rpcError.message,
        };
      }

      return {
        ok: false,
        kind: 'server',
        error: 'Ocurrió un error inesperado al procesar el pedido. Inténtalo de nuevo.',
      };
    }

    if (!rpcResult) {
      return {
        ok: false,
        kind: 'server',
        error: 'No se recibió confirmación del servidor para el pedido.',
      };
    }

    const typedResult = rpcResult as unknown as {
      order_id: string;
      total: number;
      items: OrderItemSnapshot[];
    };

    return {
      ok: true,
      orderId: typedResult.order_id,
      total: Number(typedResult.total),
      items: typedResult.items ?? [],
    };
  } catch {
    return {
      ok: false,
      kind: 'server',
      error: 'Ocurrió un problema de conexión al registrar el pedido.',
    };
  }
}
