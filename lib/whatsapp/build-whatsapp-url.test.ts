import { describe, it, expect } from 'vitest';
import {
  normalizePeruvianPhone,
  buildWhatsAppUrl,
  type WhatsAppOrderData,
} from './build-whatsapp-url';

describe('normalizePeruvianPhone', () => {
  it('normalizes local 9-digit mobile without country code', () => {
    expect(normalizePeruvianPhone('987654321')).toBe('51987654321');
  });

  it('normalizes numbers with spaces and dashes', () => {
    expect(normalizePeruvianPhone('987 654 321')).toBe('51987654321');
    expect(normalizePeruvianPhone('987-654-321')).toBe('51987654321');
  });

  it('normalizes international format with +51 prefix', () => {
    expect(normalizePeruvianPhone('+51 987 654 321')).toBe('51987654321');
    expect(normalizePeruvianPhone('+51987654321')).toBe('51987654321');
  });

  it('handles special characters, parentheses, and dots', () => {
    expect(normalizePeruvianPhone('+51 (987) 654.321')).toBe('51987654321');
  });

  it('cleans leading 0 from 10-digit formats (09XXXXXXXX)', () => {
    expect(normalizePeruvianPhone('0987654321')).toBe('51987654321');
  });
});

describe('buildWhatsAppUrl', () => {
  const baseOrder: WhatsAppOrderData = {
    storeName: 'Café Altomayo & Panadería',
    storePhoneWhatsApp: '+51 (987) 654-321',
    customerName: 'María José Nuñez Peña',
    customerPhone: '912 345 678',
    deliveryType: 'delivery',
    address: 'Av. Benavides 1230, Dpto. 402 (frente al óvalo)',
    paymentMethod: 'yape',
    items: [
      { name: 'Café Cappuccino Grande', qty: 2, subtotal: 24.0 },
      { name: 'Sánguche de Jamón del País & Sarza', qty: 1, subtotal: 18.5 },
    ],
    total: 42.5,
    orderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };

  it('builds a valid wa.me URL target with 51 prefix', () => {
    const url = buildWhatsAppUrl(baseOrder);
    expect(url.startsWith('https://wa.me/51987654321?text=')).toBe(true);
  });

  it('correctly encodes accents, tildes (á, é, í, ó, ú, ñ), symbols and emojis', () => {
    const url = buildWhatsAppUrl(baseOrder);
    const textParam = url.split('?text=')[1];
    const decoded = decodeURIComponent(textParam);

    // Assert accents and tildes are preserved in decoded message
    expect(decoded).toContain('¡Hola *Café Altomayo & Panadería*! 👋');
    expect(decoded).toContain('María José Nuñez Peña');
    expect(decoded).toContain('Sánguche de Jamón del País & Sarza');
    expect(decoded).toContain('Av. Benavides 1230, Dpto. 402 (frente al óvalo)');
    expect(decoded).toContain('• 2x Café Cappuccino Grande - S/ 24.00');
    expect(decoded).toContain('💰 *Total:* S/ 42.50');
    expect(decoded).toContain('🔖 *Pedido:* #a1b2c3d4');
  });

  it('omits order ID gracefully when orderId is null or undefined', () => {
    const fallbackOrder: WhatsAppOrderData = {
      ...baseOrder,
      orderId: null,
      deliveryType: 'pickup',
      address: null,
    };

    const url = buildWhatsAppUrl(fallbackOrder);
    const decoded = decodeURIComponent(url.split('?text=')[1]);

    expect(decoded).not.toContain('🔖 *Pedido:*');
    expect(decoded).toContain('🛍️ *Tipo de entrega:* Recojo en tienda');
    expect(decoded).not.toContain('🏠 *Dirección:*');
  });
});
