import Link from 'next/link';

export default function StoreNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-200 text-2xl font-black text-neutral-600">
        404
      </div>
      <h1 className="mt-4 text-xl font-extrabold text-neutral-900">Tienda no encontrada</h1>
      <p className="mt-2 max-w-xs text-sm text-neutral-500">
        El enlace que intentas abrir no existe o ha sido modificado.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-xl bg-neutral-900 px-6 text-sm font-semibold text-white shadow-sm transition active:scale-95 hover:bg-neutral-800"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
