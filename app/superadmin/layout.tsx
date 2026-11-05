import type { Metadata } from 'next';
import Link from 'next/link';
import { requireSuperadmin } from '@/lib/auth/require-superadmin';
import { signOutAction } from '@/app/actions/auth-actions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Superadmin | Menuki',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSuperadmin();

  return (
    <div className="min-h-dvh bg-neutral-100 text-neutral-900 antialiased">
      {/* Top Superadmin Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-neutral-900 text-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/superadmin" className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-600 text-xs font-black text-white">
                M
              </span>
              <span className="font-black text-base tracking-tight text-white">
                Menuki <span className="text-rose-400 font-semibold text-xs ml-1">SUPERADMIN</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400">
                Sesión iniciada
              </span>
              <span className="text-xs font-medium text-neutral-200">{user.email}</span>
            </div>

            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-xl border border-neutral-700 bg-neutral-800 px-3.5 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-neutral-700 hover:text-white"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
