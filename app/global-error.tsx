'use client';

import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Optional Sentry integration via environment variable
    const sentryDsn =
      process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

    if (sentryDsn && typeof window !== 'undefined' && (window as any).Sentry) {
      try {
        (window as any).Sentry.captureException(error);
      } catch {
        // Safe fallback if Sentry SDK fails to report
      }
    }

    console.error('[GlobalError] Excepción no controlada en la aplicación:', error);
  }, [error]);

  return (
    <html lang="es">
      <body className="flex min-h-dvh flex-col items-center justify-center bg-neutral-900 px-4 text-center text-white antialiased">
        <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500 text-xl font-bold">
            ⚠️
          </div>
          <h1 className="mt-4 text-xl font-black text-white">Ocurrió un error inesperado</h1>
          <p className="mt-2 text-xs text-neutral-400">
            Hemos registrado el incidente y nuestro equipo técnico está al tanto.
          </p>

          {error.digest && (
            <p className="mt-2 font-mono text-[11px] text-neutral-500">
              Código de rastreo: {error.digest}
            </p>
          )}

          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => reset()}
              className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-neutral-900 transition hover:bg-neutral-200 active:scale-95"
            >
              Reintentar
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="rounded-xl border border-neutral-800 px-5 py-2.5 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-900 active:scale-95"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
