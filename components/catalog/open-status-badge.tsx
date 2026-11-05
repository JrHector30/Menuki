'use client';

import { useState, useEffect } from 'react';
import type { StoreOpeningHours } from '@/types/domain';
import { calculateOpenStatus, type OpenStatusResult } from '@/lib/utils/business-hours';

interface OpenStatusBadgeProps {
  openingHours: StoreOpeningHours;
  isOpenManual: boolean;
}

/**
 * Client Component: Open / Closed Badge.
 * Re-evaluates status every minute in America/Lima timezone.
 * Renders neutral placeholder on SSR until client mounts.
 */
export function OpenStatusBadge({ openingHours, isOpenManual }: OpenStatusBadgeProps) {
  const [mounted, setMounted] = useState(false);
  const [status, setStatus] = useState<OpenStatusResult>({
    isOpen: false,
    message: 'Consultando...',
  });

  useEffect(() => {
    setMounted(true);
    setStatus(calculateOpenStatus(openingHours, isOpenManual));

    const intervalId = setInterval(() => {
      setStatus(calculateOpenStatus(openingHours, isOpenManual));
    }, 60000);

    return () => clearInterval(intervalId);
  }, [openingHours, isOpenManual]);

  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-500">
          <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" />
          Horario
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
          status.isOpen
            ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border border-rose-200 bg-rose-50 text-rose-700'
        }`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status.isOpen ? 'bg-emerald-500' : 'bg-rose-500'
          }`}
        />
        {status.isOpen ? 'Abierto' : 'Cerrado'}
      </span>

      <span className="text-xs text-neutral-500">{status.message}</span>
    </div>
  );
}
