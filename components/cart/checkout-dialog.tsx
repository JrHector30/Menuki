'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/stores/use-cart-store';
import { formatPEN } from '@/lib/utils/currency';
import { buildWhatsAppUrl, type WhatsAppOrderItem } from '@/lib/whatsapp/build-whatsapp-url';
import { placeOrder } from '@/app/actions/place-order';
import type { DeliveryType, PaymentMethod, Store } from '@/types/domain';
import type { CatalogItemPreview } from './floating-cart-bar';

interface CheckoutDialogProps {
  store: Store;
  products: CatalogItemPreview[];
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Native <dialog> checkout drawer.
 * - Handles phone validation, honeypot protection, and iOS Safari popup bypass.
 * - Differentiates 'validation' | 'business' errors (cancels WhatsApp, displays errors, router.refresh())
 *   from 'server' errors (opens WhatsApp as resilient fallback).
 * - Sends unique client_request_id generated on drawer open for idempotency.
 * - Uses server snapshot items if registered successfully.
 */
export function CheckoutDialog({ store, products, isOpen, onClose }: CheckoutDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [deliveryType, setDeliveryType] = useState<DeliveryType>('delivery');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('yape');
  const [honeypot, setHoneypot] = useState('');
  const [clientRequestId, setClientRequestId] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [bannerNotice, setBannerNotice] = useState<string | null>(null);

  const hasStoreWhatsApp = Boolean(store.phone_whatsapp && store.phone_whatsapp.trim().length > 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      // Generate a new idempotency key each time drawer is freshly opened
      setClientRequestId(crypto.randomUUID());
      setBannerNotice(null);
      setFieldErrors({});

      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Calculate order items and subtotal from catalog
  const orderItems = items
    .map((item) => {
      const product = productMap.get(item.product_id);
      if (!product || !product.is_available) return null;
      return {
        product,
        qty: item.qty,
        subtotal: product.price * item.qty,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const total = orderItems.reduce((acc, it) => acc + it.subtotal, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || orderItems.length === 0 || !hasStoreWhatsApp) return;

    setIsSubmitting(true);
    setFieldErrors({});
    setBannerNotice(null);

    // 1. Pre-open window synchronously to prevent iOS Safari popup blocker
    let waWindow: Window | null = null;
    try {
      waWindow = window.open('', '_blank');
    } catch {
      // Fallback if browser strictly blocks window.open
    }

    let registeredOrderId: string | null = null;
    let finalTotal = total;
    let waItems: WhatsAppOrderItem[] = orderItems.map((it) => ({
      name: it.product.name,
      qty: it.qty,
      subtotal: it.subtotal,
    }));

    // 2. Call placeOrder Server Action (idempotent with client_request_id)
    try {
      const result = await placeOrder({
        store_id: store.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        delivery_type: deliveryType,
        address: deliveryType === 'delivery' ? address : null,
        payment_method: paymentMethod,
        items: orderItems.map((it) => ({
          product_id: it.product.id,
          qty: it.qty,
        })),
        client_request_id: clientRequestId || null,
        honeypot,
      });

      if (!result.ok) {
        // Business or Validation failure -> Close WhatsApp tab, keep drawer open, do not clear cart
        if (result.kind === 'validation' || result.kind === 'business') {
          if (waWindow && !waWindow.closed) {
            waWindow.close();
          }
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          setBannerNotice(result.error);
          setIsSubmitting(false);

          // If business error (e.g. out of stock or store closed), refresh catalog
          if (result.kind === 'business') {
            router.refresh();
          }
          return;
        }

        // Server error -> Continue to WhatsApp as fallback
        setBannerNotice('No se pudo registrar en base de datos. Tu pedido se enviará por WhatsApp.');
      } else {
        registeredOrderId = result.orderId;
        finalTotal = result.total;

        // Use official server items snapshot for message accuracy
        if (result.items && result.items.length > 0) {
          waItems = result.items.map((it) => ({
            name: it.name,
            qty: it.qty,
            subtotal: it.price * it.qty,
          }));
        }
      }
    } catch {
      // Network exception -> Continue to WhatsApp as fallback
      setBannerNotice('Fallo de conexión temporal. Tu pedido se enviará directamente por WhatsApp.');
    }

    // 3. Build WhatsApp URL strictly with store.phone_whatsapp (no fallback dummy numbers)
    const waUrl = buildWhatsAppUrl({
      storeName: store.name,
      storePhoneWhatsApp: store.phone_whatsapp!,
      customerName,
      customerPhone,
      deliveryType,
      address: deliveryType === 'delivery' ? address : null,
      paymentMethod,
      items: waItems,
      total: finalTotal,
      orderId: registeredOrderId,
    });

    // 4. Redirect the open window or fallback to current window
    if (waWindow && !waWindow.closed) {
      waWindow.location.href = waUrl;
    } else {
      window.location.href = waUrl;
    }

    // 5. Cleanup upon dispatching order
    clearCart();
    setIsSubmitting(false);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="m-0 ml-auto h-full max-h-none w-full max-w-lg bg-transparent p-0 text-neutral-900 outline-none backdrop:bg-neutral-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full w-full flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
          <h2 className="text-lg font-black tracking-tight text-neutral-900">Completar pedido</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Cerrar checkout"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col justify-between overflow-y-auto">
          <div className="space-y-5 px-5 py-4">
            {bannerNotice && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                {bannerNotice}
              </div>
            )}

            {!hasStoreWhatsApp && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                Este local no tiene configurado un número de WhatsApp para recibir pedidos.
              </div>
            )}

            {/* Honeypot field (hidden from real users) */}
            <input
              type="text"
              name="honeypot"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              className="hidden"
              tabIndex={-1}
              autoComplete="off"
            />

            {/* Delivery / Pickup Tabs */}
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Modalidad de entrega
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setDeliveryType('delivery')}
                  className={`flex min-h-[48px] items-center justify-center rounded-xl border text-sm font-bold transition active:scale-95 ${
                    deliveryType === 'delivery'
                      ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  🛵 Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType('pickup')}
                  className={`flex min-h-[48px] items-center justify-center rounded-xl border text-sm font-bold transition active:scale-95 ${
                    deliveryType === 'pickup'
                      ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent'
                      : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  🛍️ Recojo en tienda
                </button>
              </div>
            </div>

            {/* Contact Fields */}
            <div className="space-y-3">
              <div>
                <label htmlFor="checkout-customer-name" className="mb-1 block text-xs font-semibold text-neutral-700">
                  Nombre y apellido *
                </label>
                <input
                  id="checkout-customer-name"
                  type="text"
                  required
                  placeholder="Ej. Sofía Ramos"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm outline-none transition focus:ring-1 ${
                    fieldErrors.customer_name
                      ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-neutral-300 focus:border-accent focus:ring-accent'
                  }`}
                />
                {fieldErrors.customer_name && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.customer_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="checkout-customer-phone" className="mb-1 block text-xs font-semibold text-neutral-700">
                  Teléfono / WhatsApp *
                </label>
                <input
                  id="checkout-customer-phone"
                  type="tel"
                  required
                  placeholder="Ej. 987 654 321"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`min-h-[48px] w-full rounded-xl border px-3.5 text-sm outline-none transition focus:ring-1 ${
                    fieldErrors.customer_phone
                      ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-500'
                      : 'border-neutral-300 focus:border-accent focus:ring-accent'
                  }`}
                />
                {fieldErrors.customer_phone && (
                  <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.customer_phone}</p>
                )}
              </div>

              {deliveryType === 'delivery' && (
                <div>
                  <label htmlFor="checkout-address" className="mb-1 block text-xs font-semibold text-neutral-700">
                    Dirección exacta y referencia *
                  </label>
                  <textarea
                    id="checkout-address"
                    required
                    rows={2}
                    placeholder="Calle Los Rosales 123, Dpto 401 (Frente al parque)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className={`w-full rounded-xl border p-3.5 text-sm outline-none transition focus:ring-1 ${
                      fieldErrors.address
                        ? 'border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-neutral-300 focus:border-accent focus:ring-accent'
                    }`}
                  />
                  {fieldErrors.address && (
                    <p className="mt-1 text-xs font-medium text-rose-600">{fieldErrors.address}</p>
                  )}
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-500">
                Método de pago
              </span>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['yape', 'plin', 'cash', 'card'] as PaymentMethod[]).map((method) => {
                  const labels: Record<PaymentMethod, string> = {
                    yape: 'Yape',
                    plin: 'Plin',
                    cash: 'Efectivo',
                    card: 'Tarjeta',
                  };
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`flex min-h-[44px] items-center justify-center rounded-xl border text-xs font-bold transition active:scale-95 ${
                        paymentMethod === method
                          ? 'border-accent bg-accent/5 text-accent ring-2 ring-accent'
                          : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      {labels[method]}
                    </button>
                  );
                })}
              </div>

              {paymentMethod === 'yape' && store.yape_number && (
                <div className="mt-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs text-neutral-600">
                  Transfiere por Yape al: <strong className="text-neutral-900">{store.yape_number}</strong>
                </div>
              )}
              {paymentMethod === 'plin' && store.plin_number && (
                <div className="mt-2.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 text-xs text-neutral-600">
                  Transfiere por Plin al: <strong className="text-neutral-900">{store.plin_number}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Sticky Checkout Footer */}
          <div className="border-t border-neutral-100 bg-neutral-50/50 p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Total a pagar</span>
              <span className="text-xl font-black text-neutral-900">{formatPEN(total)}</span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || orderItems.length === 0 || !hasStoreWhatsApp}
              className="flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-accent font-bold text-white shadow-lg transition hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? 'Registrando pedido...'
                : !hasStoreWhatsApp
                ? 'Sin WhatsApp configurado'
                : 'Confirmar y pedir por WhatsApp →'}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
