import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSuperadmin } from '@/lib/auth/is-superadmin';
import type { Database } from '@/types/database';

export type StoreRow = Database['public']['Tables']['stores']['Row'];
export type StoreRole = Database['public']['Enums']['store_role'];

export interface RequireStoreMemberResult {
  user: {
    id: string;
    email?: string;
  };
  store: StoreRow;
  role: StoreRole;
  isSuperadmin: boolean;
}

export class UnauthorizedError extends Error {
  constructor(message = 'No tienes permisos para acceder a esta tienda.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Server-only cached helper to verify store membership.
 * Safe to call multiple times in the same render pass or server action.
 *
 * If there is no active session -> redirects to /login.
 * If user is not a member of the store -> throws UnauthorizedError.
 */
export const requireStoreMember = cache(
  async (slug: string): Promise<RequireStoreMemberResult> => {
    const supabase = await createClient();

    const tStart = performance.now();

    // 1. Get authenticated user
    const tUserStart = performance.now();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    const tUser = (performance.now() - tUserStart).toFixed(1);

    if (userError || !user) {
      redirect(`/login?next=/${encodeURIComponent(slug)}/admin`);
    }

    // 2. Fetch store by slug
    const tStoreStart = performance.now();
    const { data: store, error: storeError } = await supabase
      .from('stores')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    const tStore = (performance.now() - tStoreStart).toFixed(1);

    if (storeError || !store) {
      throw new Error(`Tienda no encontrada: ${slug}`);
    }

    // 3. Verify membership or grant superadmin ownership
    const tMemberStart = performance.now();
    const { data: membership, error: memError } = await supabase
      .from('store_members')
      .select('role')
      .eq('store_id', store.id)
      .eq('user_id', user.id)
      .maybeSingle();
    const tMember = (performance.now() - tMemberStart).toFixed(1);

    const tTotal = (performance.now() - tStart).toFixed(1);
    console.log(
      `[PERF:requireStoreMember] slug=${slug} total=${tTotal}ms (getUser=${tUser}ms, getStore=${tStore}ms, getMember=${tMember}ms)`
    );

    if (isSuperadmin(user)) {
      if (!membership) {
        // Link superadmin in store_members so database RLS allows store alterations
        const adminClient = createAdminClient();
        await adminClient
          .from('store_members')
          .upsert(
            { store_id: store.id, user_id: user.id, role: 'owner' },
            { onConflict: 'store_id,user_id' }
          );
      }

      return {
        user: {
          id: user.id,
          email: user.email,
        },
        store,
        role: 'owner',
        isSuperadmin: true,
      };
    }

    if (memError || !membership) {
      throw new UnauthorizedError();
    }

    return {
      user: {
        id: user.id,
        email: user.email,
      },
      store,
      role: membership.role,
      isSuperadmin: false,
    };
  }
);
