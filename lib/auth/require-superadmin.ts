import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSuperadmin } from './is-superadmin';

export interface RequireSuperadminResult {
  user: {
    id: string;
    email: string;
  };
}

/**
 * Server-only helper to protect superadmin routes and actions.
 * Cached per render pass.
 *
 * If unauthenticated -> redirects to /login?next=/superadmin.
 * If authenticated but not a superadmin or email unconfirmed -> calls notFound().
 */
export const requireSuperadmin = cache(async (): Promise<RequireSuperadminResult> => {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect('/login?next=/superadmin');
  }

  if (!isSuperadmin(user) || !user.email) {
    notFound();
  }

  return {
    user: {
      id: user.id,
      email: user.email,
    },
  };
});
