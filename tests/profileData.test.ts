import { describe, expect, it } from 'vitest';
import { loadMyProfile, normalizePhone, saveMyProfile } from '@/lib/profile';
import { listParentContacts } from '@/lib/superAdmin';
import { NAME_ERROR } from '@/lib/profile';

type Row = Record<string, unknown>;

/** A fake of the Supabase client calls the profile code makes. Records every update. */
function fakeClient(opts: { user?: { id: string; email: string } | null; profile?: Row | null; rpcRows?: Row[]; rpcError?: string } = {}) {
  const updates: Row[] = [];
  const client = {
    updates,
    auth: {
      getUser: async () => ({ data: { user: opts.user === undefined ? { id: 'u1', email: 'lan@test.local' } : opts.user }, error: null }),
    },
    from: (_table: string) => ({
      update: (row: Row) => {
        updates.push(row);
        return { eq: async () => ({ error: null }) };
      },
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: opts.profile === undefined ? { display_name: 'Lan', phone: null, avatar_path: null, role: 'parent' } : opts.profile, error: null }) }),
      }),
    }),
    rpc: async (_name: string) => (opts.rpcError ? { data: null, error: { message: opts.rpcError } } : { data: opts.rpcRows ?? [], error: null }),
  };
  return client as never;
}

describe('saveMyProfile (PR6, PR7, PR10)', () => {
  it('trims the name and stores a null phone when the phone is empty', async () => {
    const client = fakeClient();
    await saveMyProfile({ displayName: '  Lan  ', phone: normalizePhone('  '), avatarPath: null }, client);
    expect((client as unknown as { updates: Row[] }).updates.at(-1)).toEqual({ display_name: 'Lan', phone: null, avatar_path: null });
  });

  it('refuses an invalid name before any request', async () => {
    const client = fakeClient();
    await expect(saveMyProfile({ displayName: ' ', phone: null, avatarPath: null }, client)).rejects.toThrow(NAME_ERROR);
    expect((client as unknown as { updates: Row[] }).updates).toHaveLength(0);
  });
});

describe('loadMyProfile (PR8)', () => {
  it('returns the profile with the email of the signed-in user', async () => {
    const profile = await loadMyProfile(fakeClient());
    expect(profile).toEqual({ userId: 'u1', role: 'parent', displayName: 'Lan', phone: null, avatarPath: null, email: 'lan@test.local' });
  });

  it('returns null when nobody is signed in', async () => {
    expect(await loadMyProfile(fakeClient({ user: null }))).toBeNull();
  });
});

describe('listParentContacts (SA2)', () => {
  it('maps the rpc rows, and a missing name becomes an empty string', async () => {
    const rows = await listParentContacts(fakeClient({ rpcRows: [{ user_id: 'p1', display_name: null, email: 'a@test.local', phone: '+84 912 345 678' }] }));
    expect(rows).toEqual([{ userId: 'p1', displayName: '', email: 'a@test.local', phone: '+84 912 345 678' }]);
  });

  it('throws the database message when the Super Admin check fails', async () => {
    await expect(listParentContacts(fakeClient({ rpcError: 'forbidden' }))).rejects.toThrow('forbidden');
  });
});
