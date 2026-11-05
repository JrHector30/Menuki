import Link from 'next/link';

export default function RootHomePage() {
  const demoSlug = process.env.NEXT_PUBLIC_DEMO_SLUG;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-900 px-6 text-center text-white">
      <div className="max-w-md">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Menuki</h1>
        <p className="mt-3 text-sm text-neutral-400">
          Catálogo digital y recepción de pedidos por WhatsApp para negocios locales.
        </p>

        {demoSlug && (
          <div className="mt-8 flex flex-col gap-3">
            <Link
              href={`/${demoSlug}`}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-white px-6 text-sm font-bold text-neutral-900 shadow-sm transition active:scale-95 hover:bg-neutral-100"
            >
              Ver demo del catálogo
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
