'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import type { Database } from '@/types/database';
import type { DayOfWeek, DaySchedule, StoreOpeningHours } from '@/types/domain';
import type { StoreRole } from '@/lib/auth/require-store-member';
import { getWhiteContrastRatio } from '@/lib/utils/color';
import { updateStoreConfig } from '@/app/actions/admin-store-actions';

type StoreRow = Database['public']['Tables']['stores']['Row'];

interface StoreConfigFormProps {
  slug: string;
  store: StoreRow;
  role: StoreRole;
}

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

export function StoreConfigForm({ slug, store, role }: StoreConfigFormProps) {
  const isReadOnly = role === 'staff';

  const initialHours: StoreOpeningHours =
    typeof store.opening_hours === 'object' && store.opening_hours !== null
      ? (store.opening_hours as StoreOpeningHours)
      : {};

  // Form State
  const [phoneWhatsApp, setPhoneWhatsApp] = useState(
    store.phone_whatsapp?.replace(/^51/, '') || ''
  );
  const [yapeNumber, setYapeNumber] = useState(store.yape_number || '');
  const [plinNumber, setPlinNumber] = useState(store.plin_number || '');
  const [accentColor, setAccentColor] = useState(store.accent_color || '#E11D48');
  const [isOpenManual, setIsOpenManual] = useState(store.is_open_manual);

  // Logo state
  const [logoUrl, setLogoUrl] = useState<string | null>(store.logo_url || null);
  const [logoPreview, setLogoPreview] = useState<string | null>(store.logo_url || null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // 7-day schedule state
  const [schedule, setSchedule] = useState<
    Record<DayOfWeek, { isOpen: boolean; open: string; close: string }>
  >(() => {
    const s = {} as Record<DayOfWeek, { isOpen: boolean; open: string; close: string }>;
    DAYS.forEach(({ key }) => {
      const dayData = initialHours[key];
      if (dayData && dayData.open && dayData.close && !dayData.closed) {
        s[key] = { isOpen: true, open: dayData.open, close: dayData.close };
      } else {
        s[key] = { isOpen: false, open: '09:00', close: '22:00' };
      }
    });
    return s;
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const contrastRatio = getWhiteContrastRatio(accentColor);
  const isLowContrast = contrastRatio < 4.5;

  const hasAnyActiveDay = DAYS.some(({ key }) => schedule[key].isOpen);

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setErrorMessage('Formato de logo no permitido. Usa JPG, PNG o WebP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('El archivo de logo excede los 2 MB.');
      return;
    }

    setErrorMessage(null);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleScheduleToggle(day: DayOfWeek) {
    if (isReadOnly) return;
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], isOpen: !prev[day].isOpen },
    }));
  }

  function handleTimeChange(day: DayOfWeek, field: 'open' | 'close', value: string) {
    if (isReadOnly) return;
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // If no day is active, send openingHours = {}
    const openingHours: Partial<Record<DayOfWeek, DaySchedule | null>> = {};
    if (hasAnyActiveDay) {
      DAYS.forEach(({ key }) => {
        const day = schedule[key];
        if (day.isOpen) {
          openingHours[key] = { open: day.open, close: day.close, closed: false };
        } else {
          openingHours[key] = { open: day.open, close: day.close, closed: true };
        }
      });
    }

    startTransition(async () => {
      let uploadedLogoUrl: string | null = null;

      // 1. Order: If new logo selected, upload to storage using dynamic import
      if (logoFile) {
        try {
          setIsUploadingLogo(true);
          const { uploadStoreAsset } = await import('@/lib/storage/upload-image');
          uploadedLogoUrl = await uploadStoreAsset(store.id, logoFile);
        } catch (uploadErr) {
          setIsUploadingLogo(false);
          setErrorMessage((uploadErr as Error).message || 'Error al subir el logo.');
          return;
        } finally {
          setIsUploadingLogo(false);
        }
      }

      const finalLogoUrl = uploadedLogoUrl ?? logoUrl;

      // 2. Save store configuration in database
      const res = await updateStoreConfig(slug, {
        phoneWhatsApp,
        yapeNumber: yapeNumber.trim() || null,
        plinNumber: plinNumber.trim() || null,
        logoUrl: finalLogoUrl,
        accentColor,
        isOpenManual,
        openingHours: openingHours as any,
      });

      if (!res.ok) {
        // If updating configuration fails, delete the newly uploaded logo!
        if (uploadedLogoUrl) {
          const { deleteStoreAsset } = await import('@/lib/storage/upload-image');
          await deleteStoreAsset(uploadedLogoUrl);
        }
        setErrorMessage(res.error || 'No se pudo guardar la configuración.');
      } else {
        // If succeeded, clean up old logo if it was replaced
        if (uploadedLogoUrl && store.logo_url && store.logo_url !== uploadedLogoUrl) {
          const { deleteStoreAsset } = await import('@/lib/storage/upload-image');
          await deleteStoreAsset(store.logo_url);
        }
        setLogoUrl(finalLogoUrl);
        setLogoFile(null);
        setSuccessMessage('¡Configuración actualizada exitosamente!');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {isReadOnly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-semibold text-amber-800">
          Modo de solo lectura: el rol colaborador (staff) no puede modificar la configuración del local.
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* Section 1: Logo and Branding */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
          Logo del Local
        </h2>
        <div className="mt-4 flex items-center gap-5">
          <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
            {logoPreview ? (
              <Image
                src={logoPreview}
                alt="Logo del local"
                fill
                sizes="80px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                Sin logo
              </div>
            )}
          </div>
          <div className="flex-1">
            <label htmlFor="config-logo-file" className="mb-1 block text-xs font-semibold text-neutral-700">
              Subir nuevo logo (máx. 2 MB, JPG/PNG/WebP)
            </label>
            <input
              id="config-logo-file"
              type="file"
              disabled={isReadOnly}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleLogoFileChange}
              className="block w-full text-xs text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-neutral-700 hover:file:bg-neutral-200 disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-neutral-400">
              Se redimensiona automáticamente a 800px WebP antes de guardar.
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: Contact & Payments */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
          Contacto y Pagos Móviles
        </h2>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="config-whatsapp" className="mb-1 block text-xs font-semibold text-neutral-700">
              WhatsApp de Pedidos (Perú) *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-xs font-bold text-neutral-400">+51</span>
              <input
                id="config-whatsapp"
                type="tel"
                required
                disabled={isReadOnly}
                value={phoneWhatsApp}
                onChange={(e) => setPhoneWhatsApp(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="999888777"
                className="min-h-[44px] w-full rounded-xl border border-neutral-300 pl-11 pr-3 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50"
              />
            </div>
            <p className="mt-1 text-[11px] text-neutral-400">9 dígitos comenzando con 9</p>
          </div>

          <div>
            <label htmlFor="config-yape" className="mb-1 block text-xs font-semibold text-neutral-700">
              Número Yape (opcional)
            </label>
            <input
              id="config-yape"
              type="tel"
              disabled={isReadOnly}
              value={yapeNumber}
              onChange={(e) => setYapeNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="999888777"
              className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50"
            />
          </div>

          <div>
            <label htmlFor="config-plin" className="mb-1 block text-xs font-semibold text-neutral-700">
              Número Plin (opcional)
            </label>
            <input
              id="config-plin"
              type="tel"
              disabled={isReadOnly}
              value={plinNumber}
              onChange={(e) => setPlinNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="999888777"
              className="min-h-[44px] w-full rounded-xl border border-neutral-300 px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900 disabled:bg-neutral-50"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Visual Branding & Accent Color */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
          Color de Acento de la Tienda
        </h2>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <input
              id="config-accent-picker"
              type="color"
              disabled={isReadOnly}
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-12 w-12 cursor-pointer rounded-xl border border-neutral-200 p-1"
            />
            <div>
              <label htmlFor="config-accent-hex" className="mb-1 block text-xs font-semibold text-neutral-700">
                Código Hexadecimal
              </label>
              <input
                id="config-accent-hex"
                type="text"
                disabled={isReadOnly}
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                maxLength={7}
                className="min-h-[40px] w-32 rounded-xl border border-neutral-300 px-3 font-mono text-xs uppercase outline-none focus:border-neutral-900 disabled:bg-neutral-50"
              />
            </div>
          </div>

          <div
            className="flex h-12 flex-1 items-center justify-center rounded-xl px-4 text-xs font-bold text-white shadow-sm"
            style={{ backgroundColor: accentColor }}
          >
            Muestra de Botón con Texto Blanco
          </div>
        </div>

        {isLowContrast && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            ⚠️ <strong>Bajo contraste:</strong> El ratio de contraste con texto blanco es de{' '}
            {contrastRatio.toFixed(2)}:1 (recomendado: 4.5:1 o superior según WCAG AA). Podría dificultar la legibilidad de botones.
          </div>
        )}
      </div>

      {/* Section 4: Manual Store Switch */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
              Estado Manual de la Tienda
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Si está activado, la tienda acepta pedidos sin importar el horario configurado.
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              id="config-is-open-manual"
              type="checkbox"
              disabled={isReadOnly}
              checked={isOpenManual}
              onChange={(e) => setIsOpenManual(e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-disabled:opacity-50"></div>
          </label>
        </div>
      </div>

      {/* Section 5: 7-Day Opening Hours */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-500">
          Horarios Semanales (Zona America/Lima)
        </h2>
        <p className="mt-1 text-xs text-neutral-500">
          Define el turno de atención para cada día. Permite turnos que cruzan la medianoche (ej: 20:00 a 02:00).
        </p>

        {!hasAnyActiveDay && (
          <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-800">
            ℹ️ <strong>Sin días activos:</strong> la tienda depende solo del interruptor manual.
          </div>
        )}

        <div className="mt-4 divide-y divide-neutral-100">
          {DAYS.map(({ key, label }) => {
            const day = schedule[key];
            return (
              <div
                key={key}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3 sm:w-36">
                  <input
                    id={`schedule-toggle-${key}`}
                    type="checkbox"
                    disabled={isReadOnly}
                    checked={day.isOpen}
                    onChange={() => handleScheduleToggle(key)}
                    className="h-4 w-4 rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900 disabled:opacity-50"
                  />
                  <label
                    htmlFor={`schedule-toggle-${key}`}
                    className="text-xs font-bold text-neutral-800"
                  >
                    {label}
                  </label>
                </div>

                {day.isOpen ? (
                  <div className="flex items-center gap-2">
                    <label htmlFor={`schedule-open-${key}`} className="sr-only">
                      Hora apertura {label}
                    </label>
                    <input
                      id={`schedule-open-${key}`}
                      type="time"
                      disabled={isReadOnly}
                      value={day.open}
                      onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-900 disabled:bg-neutral-50"
                    />
                    <span className="text-xs text-neutral-400">a</span>
                    <label htmlFor={`schedule-close-${key}`} className="sr-only">
                      Hora cierre {label}
                    </label>
                    <input
                      id={`schedule-close-${key}`}
                      type="time"
                      disabled={isReadOnly}
                      value={day.close}
                      onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                      className="rounded-lg border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-neutral-900 disabled:bg-neutral-50"
                    />
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-neutral-400">Cerrado</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {!isReadOnly && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending || isUploadingLogo}
            className="min-h-[48px] rounded-xl bg-neutral-900 px-8 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:opacity-50"
          >
            {isUploadingLogo ? 'Subiendo logo...' : isPending ? 'Guardando cambios...' : 'Guardar Configuración'}
          </button>
        </div>
      )}
    </form>
  );
}
