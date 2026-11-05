import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminAccess, getMyProfile, type Profile } from '@/lib/auth/roles';
import { fakeFrom } from './support/fakeSupabase';

const base: Profile = {
  user_id: 'u1',
  role: 'parent',
  display_name: 'Mum',
  banned: false,
  ban_reason_code: null,
  ban_note: null,
  banned_at: null,
  quota_bytes: 52428800,
};

describe('adminAccess (U11, U13)', () => {
  it.each([
    ['no profile', null, 'signin'],
    ['banned parent', { ...base, banned: true, ban_reason_code: 'spam' }, 'banned'],
    ['unbanned parent', base, 'ok'],
    ['super admin', { ...base, role: 'super_admin' }, 'ok'],
    ['banned super admin', { ...base, role: 'super_admin', banned: true }, 'ok'],
  ] as const)('%s -> %s', (_name, profile, expected) => {
    expect(adminAccess(profile as Profile | null)).toBe(expected);
  });
});

function client(user: { id: string } | null, row: unknown, error: unknown = null) {
  const { from, queries } = fakeFrom(() => ({ data: row, error }));
  const c = { auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) }, from };
  return { c: c as unknown as SupabaseClient, from, queries };
}

describe('getMyProfile (U1)', () => {
  it('returns null when signed out, without querying profiles', async () => {
    const { c, from } = client(null, null);
    expect(await getMyProfile(c)).toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it('returns null when there is no profile row', async () => {
    const { c } = client({ id: 'u1' }, null);
    expect(await getMyProfile(c)).toBeNull();
  });

  it('returns null when the read fails', async () => {
    const { c } = client({ id: 'u1' }, null, { message: 'boom' });
    expect(await getMyProfile(c)).toBeNull();
  });

  it('reads the own row by user_id and normalizes quota_bytes to a number', async () => {
    const { c, queries } = client({ id: 'u1' }, { ...base, quota_bytes: '52428800' });
    const p = await getMyProfile(c);
    expect(p).toEqual(base);
    expect(queries[0].table).toBe('profiles');
    expect(queries[0].filters).toEqual([['user_id', 'u1']]);
    expect(queries[0].single).toBe(true);
  });
});
