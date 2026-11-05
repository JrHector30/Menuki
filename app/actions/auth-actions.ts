'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { authLoginLimiter } from '@/lib/rate-limit/rate-limiter';
import { isSuperadmin } from '@/lib/auth/is-superadmin';

export interface AuthActionState {
  error?: string;
}

export async function signInAction(
  _prevState: AuthActionState | null,
  formData: FormData
): Promise<AuthActionState> {
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const rawNext = formData.get('next') as string | null;

  if (!email || !password) {
    return { error: 'Por favor, ingresa tu correo y contraseña.' };
  }

  // 1. Rate Limiting Check (by IP + Email)
  const reqHeaders = await headers();
  const clientIp =
    reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    reqHeaders.get('x-real-ip') ||
    '127.0.0.1';

  const rateLimitResult = await authLoginLimiter.limit(`${clientIp}:${email}`);
  if (!rateLimitResult.success) {
    return {
      error: 'Demasiados intentos fallidos. Por favor, espera unos minutos antes de intentar de nuevo.',
    };
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !authData.user) {
    return { error: 'Credenciales inválidas. Verifica tus datos e intenta nuevamente.' };
  }

  // Validate `next` destination: only relative internal path starting with '/', not '//' or '/\'
  let targetUrl: string | null = null;
  if (
    rawNext &&
    rawNext.startsWith('/') &&
    !rawNext.startsWith('//') &&
    !rawNext.startsWith('/\\') &&
    rawNext !== '/'
  ) {
    targetUrl = rawNext;
  }

  // If next is missing or invalid, resolve destination based on role and memberships
  if (!targetUrl) {
    if (isSuperadmin(authData.user)) {
      targetUrl = '/superadmin';
    } else {
      const { data: memberships } = await supabase
        .from('store_members')
        .select('stores(slug)')
        .eq('user_id', authData.user.id)
        .limit(1);

      const firstStore = memberships?.[0]?.stores as { slug: string } | null;
      targetUrl = firstStore?.slug ? `/${firstStore.slug}/admin` : '/';
    }
  }

  redirect(targetUrl);
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
