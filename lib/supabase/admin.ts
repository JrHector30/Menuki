import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Supabase Admin Client (Service Role).
 *
 * Runs with elevated privileges, bypassing Row Level Security (RLS).
 * Protected by 'server-only' to guarantee this file is never bundled into Client Components.
 * Used exclusively for server-side trusted operations (e.g. calling create_order_secure RPC).
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL environment variable');
  }

  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Never prefix this key with NEXT_PUBLIC_!'
    );
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
