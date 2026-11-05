import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable'
  );
}

/**
 * Public stateless Supabase client without cookies.
 * Injects Next.js fetch options (revalidate: 60, tags: ['catalog'])
 * to enable ISR and static prerendering while allowing on-demand revalidation.
 */
export const supabasePublic = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: (url, options = {}) =>
      fetch(url, {
        ...options,
        next: {
          revalidate: 60,
          tags: ['catalog'],
        },
      }),
  },
});
