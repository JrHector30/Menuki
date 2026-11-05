'use client';

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function StoreError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Store catalog error:', error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-2xl text-rose-600">
        ⚠️
      </div>
      <h1 className="mt-4 text-xl font-extrabold text-neutral-900">
        Ocurrió un problema al cargar el menú
      </h1>
      <p className="mt-2 max-w-xs text-sm text-neutral-500">
        No pudimos conectar con los servidores del catálogo. Por favor inténtalo de nuevo.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition active:scale-95 hover:bg-neutral-800"
      >
        Reintentar
      </button>
    </main>
  );
}
