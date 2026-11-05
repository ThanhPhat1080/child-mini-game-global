import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createChild, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec V2-V5, V7, U15: review workflow, ban and quota functions (all security definer).

const CODES = [
  'inaccurate', 'sexual', 'violent_scary', 'political', 'hate', 'off_target', 'personal_or_copyright', 'other',
];

async function card(owner: string | null, vis: 'private' | 'pending' | 'global' = 'private') {
  const r = await superQuery<{ id: string }>(
    `insert into public.memory_cards (word, image_path, owner_id, visibility)
       values ('w', 'x.svg', $1, $2::public.visibility) returning id`,
    [owner, vis],
  );
  return r[0].id;
}
const vis = async (id: string) =>
  (await superQuery<{ visibility: string }>(`select visibility from public.memory_cards where id = $1`, [id]))[0].visibility;
const call = (u: string, fn: string, ...args: unknown[]) =>
  as(u).query(`select public.${fn}(${args.map((_, i) => `$${i + 1}`).join(', ')})`, args);

describe('review workflow (V2-V5, V7)', () => {
  let sa: string;
  let a: string;
  let b: string;
  let child: string;
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
    await superQuery('delete from public.memory_cards');
    sa = await createUser('super_admin');
    a = await createUser('parent');
    b = await createUser('parent');
    // A children row id is not a user: as(child) acts as a signed-in user with no profile.
    child = await createChild(a);
  });

  it('walks private -> pending -> global -> unpublished -> private', async () => {
    const id = await card(a);
    await call(a, 'share_item', 'memory_cards', id);
    expect(await vis(id)).toBe('pending');
    await call(sa, 'review_approve', 'memory_cards', id);
    expect(await vis(id)).toBe('global');
    await call(sa, 'unpublish_item', 'memory_cards', id);
    expect(await vis(id)).toBe('private');
  });

  it('works on quiz_sets too', async () => {
    await superQuery('alter table public.quiz_sets disable trigger quiz_sets_publish_gate');
    const s = await superQuery<{ id: string }>(
      `insert into public.quiz_sets (title, owner_id) values ('t', $1) returning id`,
      [a],
    );
    await call(a, 'share_item', 'quiz_sets', s[0].id);
    await call(sa, 'review_approve', 'quiz_sets', s[0].id);
    const r = await superQuery<{ visibility: string }>(`select visibility from public.quiz_sets where id = $1`, [s[0].id]);
    expect(r[0].visibility).toBe('global');
  });

  it('reject returns to private with a readable note; an empty note raises', async () => {
    const id = await card(a);
    await call(a, 'share_item', 'memory_cards', id);
    await expect(call(sa, 'review_reject', 'memory_cards', id, '   ')).rejects.toThrow(/note_required/);
    expect(await vis(id)).toBe('pending');
    await call(sa, 'review_reject', 'memory_cards', id, 'Blurry picture');
    expect(await vis(id)).toBe('private');
    const ev = await as(a).query<{ kind: string; note: string }>(
      `select kind, note from public.review_events where item_id = $1`,
      [id],
    );
    expect(ev).toEqual([{ kind: 'rejection', note: 'Blurry picture' }]);
    expect(await as(b).query(`select * from public.review_events`)).toEqual([]);
    expect(await as(sa).query(`select * from public.review_events`)).toHaveLength(1);
  });

  it('non-owners and children cannot share; only private rows can be shared', async () => {
    const id = await card(a);
    await expect(call(b, 'share_item', 'memory_cards', id)).rejects.toThrow();
    await expect(call(child, 'share_item', 'memory_cards', id)).rejects.toThrow();
    await expect(call(sa, 'share_item', 'memory_cards', id)).rejects.toThrow();
    await call(a, 'share_item', 'memory_cards', id);
    await expect(call(a, 'share_item', 'memory_cards', id)).rejects.toThrow();
    expect(await vis(id)).toBe('pending');
  });

  it('rejects unknown table names', async () => {
    const id = await card(a);
    await expect(call(a, 'share_item', 'profiles', id)).rejects.toThrow(/invalid_table/);
  });

  it('approve, reject, unpublish and delete are Super Admin only', async () => {
    const pending = await card(a, 'pending');
    const global = await card(a, 'global');
    for (const u of [a, b, child]) {
      await expect(call(u, 'review_approve', 'memory_cards', pending)).rejects.toThrow();
      await expect(call(u, 'review_reject', 'memory_cards', pending, 'x')).rejects.toThrow();
      await expect(call(u, 'unpublish_item', 'memory_cards', global)).rejects.toThrow();
      await expect(call(u, 'delete_item', 'memory_cards', global)).rejects.toThrow();
    }
    await expect(call(sa, 'review_approve', 'memory_cards', global)).rejects.toThrow(/not_pending/);
    await call(sa, 'delete_item', 'memory_cards', global);
    expect(await superQuery(`select 1 from public.memory_cards where id = $1`, [global])).toEqual([]);
  });

  it('request_edit works only on own global rows and records an event', async () => {
    const g = await card(a, 'global');
    const p = await card(a, 'private');
    await expect(call(b, 'request_edit', 'memory_cards', g, 'fix')).rejects.toThrow();
    await expect(call(a, 'request_edit', 'memory_cards', p, 'fix')).rejects.toThrow();
    await call(a, 'request_edit', 'memory_cards', g, 'Please unpublish');
    const ev = await as(sa).query<{ kind: string; note: string; created_by: string }>(
      `select kind, note, created_by from public.review_events where item_id = $1`,
      [g],
    );
    expect(ev).toEqual([{ kind: 'edit_request', note: 'Please unpublish', created_by: a }]);
    expect(await as(a).query(`select * from public.review_events where item_id = $1`, [g])).toHaveLength(1);
  });

  it('review_events cannot be written by clients', async () => {
    const id = await card(a);
    await expect(
      as(a).query(
        `insert into public.review_events (item_table, item_id, kind, created_by, owner_id)
           values ('memory_cards', $1, 'edit_request', $2, $2)`,
        [id, a],
      ),
    ).rejects.toThrow();
  });

  describe('ban_parent and unban_parent (U15)', () => {
    it('rejects an unknown code, and Super Admin, child or unknown targets', async () => {
      await expect(call(sa, 'ban_parent', a, 'bogus', null)).rejects.toThrow(/invalid_reason/);
      await expect(call(sa, 'ban_parent', sa, 'other', 'x')).rejects.toThrow(/not_a_parent/);
      await expect(call(sa, 'ban_parent', child, 'other', 'x')).rejects.toThrow(/not_a_parent/);
      await expect(call(sa, 'ban_parent', '00000000-0000-0000-0000-000000000001', 'other', null)).rejects.toThrow(/not_a_parent/);
    });

    it.each(CODES)('accepts the code %s', async (code) => {
      await call(sa, 'ban_parent', a, code, 'note');
      const r = await superQuery<{ banned: boolean; ban_reason_code: string; ban_note: string; banned_at: Date }>(
        `select banned, ban_reason_code, ban_note, banned_at from public.profiles where user_id = $1`,
        [a],
      );
      expect(r[0]).toMatchObject({ banned: true, ban_reason_code: code, ban_note: 'note' });
      expect(r[0].banned_at).toBeInstanceOf(Date);
    });

    it('only a Super Admin bans or unbans', async () => {
      await expect(call(a, 'ban_parent', b, 'other', null)).rejects.toThrow();
      await expect(call(child, 'ban_parent', b, 'other', null)).rejects.toThrow();
      await call(sa, 'ban_parent', a, 'other', null);
      await expect(call(b, 'unban_parent', a)).rejects.toThrow();
      await expect(call(a, 'unban_parent', a)).rejects.toThrow();
    });

    it('hides all of the parent\'s rows and unban restores them exactly', async () => {
      const ids = [await card(a, 'private'), await card(a, 'pending'), await card(a, 'global')];
      const before = await Promise.all(ids.map(vis));
      await call(sa, 'ban_parent', a, 'hate', null);
      expect(await as(a).query(`select id from public.memory_cards`)).toEqual([]);
      expect(await as(child).query(`select id from public.memory_cards`)).toEqual([]);
      expect(await as(b).query(`select id from public.memory_cards`)).toEqual([]);
      expect(await Promise.all(ids.map(vis))).toEqual(before);
      await call(sa, 'unban_parent', a);
      expect(await as(a).query(`select id from public.memory_cards`)).toHaveLength(3);
      const r = await superQuery(
        `select banned, ban_reason_code, ban_note, banned_at from public.profiles where user_id = $1`,
        [a],
      );
      expect(r[0]).toEqual({ banned: false, ban_reason_code: null, ban_note: null, banned_at: null });
    });

    it('a banned parent can no longer share', async () => {
      const id = await card(a);
      await call(sa, 'ban_parent', a, 'other', null);
      await expect(call(a, 'share_item', 'memory_cards', id)).rejects.toThrow();
    });
  });

  describe('set_quota', () => {
    it('is Super Admin only and only for parents', async () => {
      await call(sa, 'set_quota', a, 1000);
      const r = await superQuery<{ quota_bytes: string }>(`select quota_bytes from public.profiles where user_id = $1`, [a]);
      expect(Number(r[0].quota_bytes)).toBe(1000);
      await expect(call(a, 'set_quota', a, 99999999)).rejects.toThrow();
      await expect(call(child, 'set_quota', a, 1)).rejects.toThrow();
      await expect(call(sa, 'set_quota', child, 1)).rejects.toThrow(/not_a_parent/);
      await expect(call(sa, 'set_quota', a, -1)).rejects.toThrow();
    });
  });
});
