import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyUserId } from '@/lib/review';

export type Quota = { used: number; quota: number };

/** The signed-in user's stored bytes and their quota (Q4), or null when it cannot be read. */
export async function getMyQuota(): Promise<Quota | null> {
  const client = createSupabaseBrowserClient();
  const me = await getMyUserId(client);
  if (!me) return null;
  const [profile, used] = await Promise.all([
    client.from('profiles').select('quota_bytes').eq('user_id', me).maybeSingle(),
    client.rpc('storage_used', { p_owner: me }),
  ]);
  if (profile.error || !profile.data || used.error) return null;
  return { used: Number(used.data), quota: Number((profile.data as { quota_bytes: number | string }).quota_bytes) };
}
