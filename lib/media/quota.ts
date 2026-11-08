import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getMyUserId } from '@/lib/review';
import { listPeople, storageUsedBy } from '@/lib/superAdmin';

/**
 * `quota` is null for a Super Admin (no limit, the upload trigger skips them too). For a Super Admin `used` is the
 * storage of all families: their own files and every parent's.
 */
export type Quota = { used: number; quota: number | null };

/** The signed-in user's stored bytes and their quota (Q4), or null when it cannot be read. */
export async function getMyQuota(): Promise<Quota | null> {
  const client = createSupabaseBrowserClient();
  const me = await getMyUserId(client);
  if (!me) return null;
  const profile = await client.from('profiles').select('quota_bytes, role').eq('user_id', me).maybeSingle();
  if (profile.error || !profile.data) return null;
  const row = profile.data as { quota_bytes: number | string; role: string };
  if (row.role === 'super_admin') {
    const parents = await listPeople('parent', client);
    const per = await storageUsedBy([me, ...parents.map((p) => p.userId)], client);
    return { used: Object.values(per).reduce((sum, bytes) => sum + bytes, 0), quota: null };
  }
  const used = await client.rpc('storage_used', { p_owner: me });
  if (used.error) return null;
  return { used: Number(used.data), quota: Number(row.quota_bytes) };
}
