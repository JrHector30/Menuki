'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Database } from '@/types/database';
import type { OrderItemSnapshot } from '@/types/domain';
import { formatCurrency } from '@/lib/utils/currency';
import { normalizePeruvianPhone } from '@/lib/whatsapp/build-whatsapp-url';
import { updateOrderStatus, type OrderStatus } from '@/app/actions/admin-order-actions';

type OrderRow = Database['public']['Tables']['orders']['Row'];

interface OrdersManagerProps {
  slug: string;
  orders: OrderRow[];
}

const STATUS_LABELS: Record<OrderStatus, { label: string; badgeClass: string }> = {
  pending: { label: 'Pendiente', badgeClass: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmado', badgeClass: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'En Preparación', badgeClass: 'bg-indigo-100 text-indigo-800' },
  delivered: { label: 'Entregado', badgeClass: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelado', badgeClass: 'bg-rose-100 text-rose-800' },
};

const DELIVERY_LABELS: Record<string, string> = {
  delivery: 'Delivery a domicilio',
  pickup: 'Recojo en local',
  dine_in: 'Consumo en salón',
};

const PAYMENT_LABELS: Record<string, string> = {
  yape: 'Yape',
  plin: 'Plin',
  cash: 'Efectivo',
  card: 'Tarjeta (POS)',
};

export function OrdersManager({ slug, orders }: OrdersManagerProps) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Background refresh every 30s while document tab is visible
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        router.refresh();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [router]);

  function handleStatusChange(orderId: string, nextStatus: OrderStatus) {
    if (processingId) return;

    setErrorMessage(null);
    setProcessingId(orderId);

    startTransition(async () => {
      const res = await updateOrderStatus(slug, orderId, nextStatus);
      if (!res.ok) {
        setErrorMessage(res.error || 'No se pudo actualizar el estado del pedido.');
      }
      setProcessingId(null);
    });
  }

  const filteredOrders = orders.filter((o) => {
    if (statusFilter === 'all') return true;
    return o.status === statusFilter;
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

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 pb-3">
        {[
          { key: 'all', label: `Todos (${orders.length})` },
          { key: 'pending', label: 'Pendientes' },
          { key: 'confirmed', label: 'Confirmados' },
          { key: 'preparing', label: 'En Preparación' },
          { key: 'delivered', label: 'Entregados' },
          { key: 'cancelled', label: 'Cancelados' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
              statusFilter === tab.key
                ? 'bg-neutral-900 text-white'
                : 'bg-white text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center text-xs text-neutral-500">
          No hay pedidos con el filtro seleccionado.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const isBusy = processingId === order.id;
            const statusConfig = STATUS_LABELS[order.status] || {
              label: order.status,
              badgeClass: 'bg-neutral-100 text-neutral-700',
            };

            const items: OrderItemSnapshot[] = Array.isArray(order.items_json)
              ? (order.items_json as unknown as OrderItemSnapshot[])
              : [];

            const normalizedCustomerPhone = normalizePeruvianPhone(order.customer_phone);
            const waText = encodeURIComponent(
              `¡Hola ${order.customer_name}! Te saludamos de ${slug}. Con respecto a tu pedido #${order.id.slice(0, 6)}:`
            );
            const customerWhatsAppUrl = `https://wa.me/${normalizedCustomerPhone}?text=${waText}`;

            return (
              <div
                key={order.id}
                className={`overflow-hidden rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition ${
                  isBusy ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-bold text-neutral-400">
                      #{order.id.slice(0, 8)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusConfig.badgeClass}`}
                    >
                      {statusConfig.label}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {new Date(order.created_at).toLocaleTimeString('es-PE', {
                        timeZone: 'America/Lima',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-neutral-900">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-neutral-700 sm:grid-cols-2">
                  <div>
                    <span className="font-bold text-neutral-900">{order.customer_name}</span>
                    <div className="mt-0.5 flex items-center gap-2 text-neutral-500">
                      <span>{order.customer_phone}</span>
                      <a
                        href={customerWhatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:underline"
                      >
                        💬 WhatsApp
                      </a>
                    </div>
                  </div>

                  <div className="text-neutral-500 sm:text-right">
                    <div>{DELIVERY_LABELS[order.delivery_type] || order.delivery_type}</div>
                    <div>Pago: {PAYMENT_LABELS[order.payment_method] || order.payment_method}</div>
                    {order.address && (
                      <div className="line-clamp-1 font-medium text-neutral-700">
                        📍 {order.address}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Collapsible Detail */}
                <details className="mt-4 border-t border-neutral-100 pt-3 text-xs">
                  <summary className="cursor-pointer font-bold text-neutral-600 hover:text-neutral-900">
                    Ver detalle de productos ({items.reduce((acc, it) => acc + (it.qty || 1), 0)})
                  </summary>
                  <ul className="mt-2 divide-y divide-neutral-50 rounded-xl bg-neutral-50 p-3">
                    {items.map((item, idx) => (
                      <li key={idx} className="flex justify-between py-1.5 text-neutral-800">
                        <span>
                          <strong className="text-neutral-900">{item.qty}x</strong> {item.name}
                        </span>
                        <span className="font-mono text-neutral-600">
                          {formatCurrency(Number(item.price) * item.qty)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>

                {/* Status action buttons */}
                <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-3">
                  {order.status === 'pending' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(order.id, 'confirmed')}
                        className="rounded-xl bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-neutral-800"
                      >
                        Confirmar Pedido
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(order.id, 'cancelled')}
                        className="rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {order.status === 'confirmed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(order.id, 'preparing')}
                        className="rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-indigo-700"
                      >
                        En Preparación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(order.id, 'cancelled')}
                        className="rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {order.status === 'preparing' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(order.id, 'delivered')}
                        className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-emerald-700"
                      >
                        Marcar como Entregado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(order.id, 'cancelled')}
                        className="rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
