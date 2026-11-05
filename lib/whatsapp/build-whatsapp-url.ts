import { formatPEN } from '@/lib/utils/currency';
import type { DeliveryType, PaymentMethod } from '@/types/domain';

export interface WhatsAppOrderItem {
  name: string;
  qty: number;
  subtotal: number;
}

export interface WhatsAppOrderData {
  storeName: string;
  storePhoneWhatsApp: string;
  customerName: string;
  customerPhone: string;
  deliveryType: DeliveryType;
  address?: string | null;
  paymentMethod: PaymentMethod;
  items: WhatsAppOrderItem[];
  total: number;
  orderId?: string | null;
}

/**
 * Normalizes phone numbers to Peruvian international format: 51 + 9 digits.
 * Removes non-digits, leading +, spaces, hyphens, and local prefixes.
 */
export function normalizePeruvianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  if (digits.length === 11 && digits.startsWith('519')) {
    return digits;
  }

  if (digits.length === 9 && digits.startsWith('9')) {
    return `51${digits}`;
  }

  if (digits.length === 10 && digits.startsWith('09')) {
    return `51${digits.slice(1)}`;
  }

  return digits;
}

const PAYMENT_NAMES: Record<PaymentMethod, string> = {
  yape: 'Yape',
  plin: 'Plin',
  cash: 'Efectivo',
  card: 'Tarjeta (POS)',
};

const DELIVERY_NAMES: Record<DeliveryType, string> = {
  delivery: 'Delivery a domicilio',
  pickup: 'Recojo en tienda',
  dine_in: 'Consumo en local',
};

/**
 * Pure function building encoded WhatsApp order URL.
 */
export function buildWhatsAppUrl(data: WhatsAppOrderData): string {
  const phone = normalizePeruvianPhone(data.storePhoneWhatsApp);

  const shortId = data.orderId ? `#${data.orderId.slice(0, 8)}` : null;

  const itemsFormatted = data.items
    .map((item) => `• ${item.qty}x ${item.name} - ${formatPEN(item.subtotal)}`)
    .join('\n');

  const deliverySection =
    data.deliveryType === 'delivery'
      ? `🛵 *Tipo de entrega:* ${DELIVERY_NAMES[data.deliveryType]}\n🏠 *Dirección:* ${data.address?.trim() || 'No especificada'}`
      : `🛍️ *Tipo de entrega:* ${DELIVERY_NAMES[data.deliveryType]}`;

  const messageLines = [
    `¡Hola *${data.storeName}*! 👋 Quisiera realizar el siguiente pedido:`,
    '',
    shortId ? `🔖 *Pedido:* ${shortId}` : null,
    '📋 *Detalle del pedido:*',
    itemsFormatted,
    '',
    `💰 *Total:* ${formatPEN(data.total)}`,
    '',
    deliverySection,
    `👤 *Cliente:* ${data.customerName.trim()} (${data.customerPhone.trim()})`,
    `💳 *Método de pago:* ${PAYMENT_NAMES[data.paymentMethod]}`,
    '',
    'Por favor confírmenme la recepción del pedido. ¡Muchas gracias!',
  ].filter((line): line is string => line !== null);

  const fullMessage = messageLines.join('\n');
  return `https://wa.me/${phone}?text=${encodeURIComponent(fullMessage)}`;
}
