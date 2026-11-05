import type { SupabaseClient } from '@supabase/supabase-js';

/** Roles of spec U1. */
export type Role = 'super_admin' | 'parent';

/** The columns of `public.profiles` the app reads (U1). */
export type Profile = {
  user_id: string;
  role: Role;
  display_name: string | null;
  banned: boolean;
  ban_reason_code: string | null;
  ban_note: string | null;
  banned_at: string | null;
  quota_bytes: number;
};

export const ROLES: readonly Role[] = ['super_admin', 'parent'];

const PROFILE_COLUMNS =
  'user_id, role, display_name, banned, ban_reason_code, ban_note, banned_at, quota_bytes';

/**
 * The signed-in user's own profile, or null when signed out, when the row is missing or when the read
 * fails. Uses getUser() (validated by the Auth server), never getSession().
 */
export async function getMyProfile(client: SupabaseClient): Promise<Profile | null> {
  const { data: userData, error: userError } = await client.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return null;

  const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).eq('user_id', user.id).maybeSingle();
  if (error || !data) return null;
  const row = data as Omit<Profile, 'quota_bytes'> & { quota_bytes: number | string };
  return { ...row, quota_bytes: Number(row.quota_bytes) };
}

/**
 * Who may open /admin (U11, U13): Super Admins and unbanned parents. Only parents are banned; a banned
 * Super Admin is not a case the app enforces and is treated as ok.
 */
export function adminAccess(p: Profile | null): 'ok' | 'signin' | 'forbidden' | 'banned' {
  if (!p) return 'signin';
  if (p.role === 'super_admin') return 'ok';
  return p.banned ? 'banned' : 'ok';
}
