// Resolved by Next's bundled copy (no npm dependency): a client-component import fails the build.
// Plain Node/Vitest cannot resolve it, so tests mock this module (vi.mock('@/lib/supabase/service')).
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER ONLY. Service-role client that bypasses RLS (U8). Import it only from route handlers under
 * app/api; never from a client component or anything a client component imports. The key lives in the
 * server-only env var SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC_) and must never reach a response.
 */
export function createSupabaseServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set (server-only env var, see .env.example).');
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
