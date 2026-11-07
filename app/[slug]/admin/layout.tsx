import Link from 'next/link';
import type { Metadata } from 'next';
import { requireStoreMember, UnauthorizedError } from '@/lib/auth/require-store-member';
import { isSuperadmin } from '@/lib/auth/is-superadmin';
import { signOutAction } from '@/app/actions/auth-actions';
import { hexToRgb } from '@/lib/utils/color';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

interface AdminLayoutProps {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function AdminLayout({ children, params }: AdminLayoutProps) {
  const { slug } = await params;

  let memberData;
  try {
    memberData = await requireStoreMember(slug);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return (
        <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-900 px-4 text-center text-white">
          <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-950 p-8 shadow-2xl">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="mt-4 text-xl font-bold text-white">Acceso no autorizado (403)</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Tu cuenta no tiene permisos asignados para administrar esta tienda.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="rounded-xl border border-neutral-800 px-4 py-2.5 text-xs font-semibold text-neutral-300 transition hover:bg-neutral-900"
                >
                  Cerrar sesión
                </button>
              </form>
              <Link
                href={`/${slug}`}
                className="rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-neutral-900 transition hover:bg-neutral-200"
              >
                Ver catálogo público
              </Link>
            </div>
          </div>
        </main>
      );
    }
    throw err;
  }

  const { store, role } = memberData;
  const isUserSuperadmin = memberData.isSuperadmin || isSuperadmin(memberData.user);
  const accentRgb = hexToRgb(store.accent_color || '#E11D48');

  return (
    <div
      className="min-h-dvh bg-neutral-100 text-neutral-900 antialiased"
      style={{ '--accent-rgb': accentRgb } as React.CSSProperties}
    >
      {/* Desktop & Tablet Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {isUserSuperadmin && (
              <Link
                href="/superadmin"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-neutral-800 active:scale-95"
                title="Volver a la lista de locales"
              >
                <span>←</span>
                <span>Locales</span>
              </Link>
            )}

            <Link href={`/${slug}/admin`} className="group flex min-w-0 items-center gap-2">
              <span className="truncate text-base sm:text-lg font-black tracking-tight text-neutral-900 group-hover:opacity-80">
                {store.name}
              </span>
              <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-600">
                {role.toUpperCase()}
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex ml-2">
              <Link
                href={`/${slug}/admin`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Dashboard
              </Link>
              <Link
                href={`/${slug}/admin/pedidos`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Pedidos
              </Link>
              <Link
                href={`/${slug}/admin/productos`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Productos
              </Link>
              <Link
                href={`/${slug}/admin/categorias`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Categorías
              </Link>
              <Link
                href={`/${slug}/admin/configuracion`}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Configuración
              </Link>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/${slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 sm:inline-flex"
            >
              Ver catálogo ↗
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-rose-50 hover:text-rose-600"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Suspended Membership Alert Banner */}
      {!store.is_active && (
        <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-900">
              !
            </span>
            <p className="text-xs font-medium sm:text-sm">
              <strong className="font-semibold">Membresía suspendida:</strong> El catálogo público de tu local está temporalmente desactivado y no puede recibir pedidos. Comunícate con la administración de Menuki para renovar tu suscripción y reactivarlo.
            </p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>

      {/* Mobile Bottom Navigation Bar (Thumb Friendly) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-neutral-200 bg-white/95 px-2 py-2 pb-safe backdrop-blur-md md:hidden">
        <Link
          href={`/${slug}/admin`}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold text-neutral-700 active:text-neutral-950"
        >
          <span>📊</span>
          <span>Inicio</span>
        </Link>
        <Link
          href={`/${slug}/admin/pedidos`}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold text-neutral-700 active:text-neutral-950"
        >
          <span>📦</span>
          <span>Pedidos</span>
        </Link>
        <Link
          href={`/${slug}/admin/productos`}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold text-neutral-700 active:text-neutral-950"
        >
          <span>🍔</span>
          <span>Productos</span>
        </Link>
        <Link
          href={`/${slug}/admin/categorias`}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold text-neutral-700 active:text-neutral-950"
        >
          <span>📑</span>
          <span>Categorías</span>
        </Link>
        <Link
          href={`/${slug}/admin/configuracion`}
          className="flex flex-1 flex-col items-center justify-center py-1 text-[11px] font-semibold text-neutral-700 active:text-neutral-950"
        >
          <span>⚙️</span>
          <span>Ajustes</span>
        </Link>
      </nav>
    </div>
  );
}
