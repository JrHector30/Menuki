'use client';

import { Suspense, useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { signInAction } from '@/app/actions/auth-actions';

function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/';

  const [state, formAction, isPending] = useActionState(signInAction, null);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />

      {state?.error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {state.error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="mb-1 block text-xs font-semibold text-neutral-700">
          Correo electrónico
        </label>
        <input
          id="login-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="admin@tunegocio.pe"
          className="min-h-[48px] w-full rounded-xl border border-neutral-300 px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1 block text-xs font-semibold text-neutral-700">
          Contraseña
        </label>
        <input
          id="login-password"
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="••••••••"
          className="min-h-[48px] w-full rounded-xl border border-neutral-300 px-3.5 text-sm outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-neutral-900 font-bold text-white transition hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-50"
      >
        {isPending ? 'Iniciando sesión...' : 'Ingresar'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-neutral-900 px-4 text-neutral-900">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="text-center">
          <span className="text-2xl font-black tracking-tight text-neutral-900">Menuki</span>
          <h1 className="mt-2 text-lg font-bold text-neutral-800">Acceso al Panel Administrativo</h1>
          <p className="mt-1 text-xs text-neutral-500">
            Ingresa con las credenciales asignadas para tu local.
          </p>
        </div>

        <Suspense
          fallback={
            <div className="mt-6 flex min-h-[200px] items-center justify-center text-xs text-neutral-400">
              Cargando formulario...
            </div>
          }
        >
          <LoginForm />
        </Suspense>

        <p className="mt-6 text-center text-[11px] text-neutral-400">
          El acceso está restringido a propietarios y colaboradores autorizados.
        </p>
      </div>
    </main>
  );
}
