import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, connect, createChild, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec K1-K6, KT1, KT2: children are plain rows owned by a parent.

const INSERT = `insert into public.children (child_name, display_name, gender, age_band, pin)
                values ($1, 'Kid', 'female', '2-5', 'ab12') returning id`;

describe('children (K1-K6)', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('parent selects only own children', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const c1 = await createChild(a);
    const c2 = await createChild(a);
    await createChild(b);
    const rows = await as(a).query<{ id: string }>(`select id from public.children`);
    expect(rows.map((r) => r.id).sort()).toEqual([c1, c2].sort());
  });

  it('parent can insert for self (parent_id defaults to auth.uid())', async () => {
    const a = await createUser('parent');
    const rows = await as(a).query<{ id: string }>(INSERT, ['Mia']);
    expect(rows).toHaveLength(1);
    const own = await superQuery<{ parent_id: string }>(`select parent_id from public.children where id = $1`, [rows[0].id]);
    expect(own[0].parent_id).toBe(a);
  });

  it('parent cannot insert for another parent', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    await expect(
      as(a).query(
        `insert into public.children (parent_id, child_name, display_name, gender, age_band, pin)
         values ($1, 'x1', 'Kid', 'male', '2-5', 'ab12')`,
        [b],
      ),
    ).rejects.toThrow();
  });

  it("parent cannot update or delete another parent's child", async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const cb = await createChild(b);
    expect(await as(a).query(`update public.children set display_name = 'x' where id = $1 returning id`, [cb])).toEqual([]);
    expect(await as(a).query(`delete from public.children where id = $1 returning id`, [cb])).toEqual([]);
    expect(await superQuery(`select 1 from public.children where id = $1`, [cb])).toHaveLength(1);
  });

  it('a banned parent cannot write children but still reads them', async () => {
    const a = await createUser('parent', { banned: true });
    const c = await createChild(a);
    expect(await as(a).query(`select id from public.children`)).toHaveLength(1);
    await expect(as(a).query(INSERT, ['zed'])).rejects.toThrow();
    expect(await as(a).query(`update public.children set display_name = 'x' where id = $1 returning id`, [c])).toEqual([]);
    expect(await as(a).query(`delete from public.children where id = $1 returning id`, [c])).toEqual([]);
  });

  it('sixth child is rejected with too_many_children', async () => {
    const p = await createUser('parent');
    for (let i = 0; i < 5; i++) await createChild(p);
    await expect(createChild(p)).rejects.toThrow(/too_many_children/);
    const other = await createUser('parent');
    await createChild(other); // another parent is unaffected
    // Updating an existing child of a full parent is fine.
    await superQuery(`update public.children set display_name = 'x' where parent_id = $1`, [p]);
  });

  it('two concurrent inserts for the last slot: one fails', async () => {
    const p = await createUser('parent');
    for (let i = 0; i < 4; i++) await createChild(p);
    const ins = `insert into public.children (parent_id, child_name, display_name, gender, age_band, pin)
                 values ($1, $2, 'Kid', 'male', '2-5', 'ab12')`;
    const a = await connect();
    const b = await connect();
    try {
      await a.query('begin');
      await b.query('begin');
      await a.query(ins, [p, 'last-a']);
      const bPid = (await b.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid;
      const bInsert = b.query(ins, [p, 'last-b']).then(
        () => null,
        (e: Error) => e,
      );
      let waiting = false;
      for (let i = 0; i < 100 && !waiting; i++) {
        const rows = await superQuery<{ n: string }>(
          `select count(*) as n from pg_stat_activity where pid = $1 and wait_event_type = 'Lock'`,
          [bPid],
        );
        waiting = rows[0].n === '1';
        if (!waiting) await new Promise((r) => setTimeout(r, 20));
      }
      expect(waiting).toBe(true);
      await a.query('commit');
      const err = await bInsert;
      expect(err?.message).toMatch(/too_many_children/);
      await b.query('rollback');
    } finally {
      a.release();
      b.release();
    }
    expect(Number((await superQuery<{ n: string }>(`select count(*) n from public.children where parent_id = $1`, [p]))[0].n)).toBe(5);
  });

  it('child_name is unique across parents ignoring case and extra spaces', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    await createChild(a, { childName: 'Lan' });
    await expect(createChild(b, { childName: ' lan ' })).rejects.toThrow(/duplicate key/);
    await expect(createChild(b, { childName: 'LAN' })).rejects.toThrow(/duplicate key/);
    await createChild(a, { childName: 'La n' });
    await expect(createChild(b, { childName: 'La  n' })).rejects.toThrow(/duplicate key/);
    // 'La n' and 'Lan' are different names (the first space is kept); 'Lan' already exists above,
    // so check the pair on fresh names.
    await createChild(a, { childName: 'Bo b' });
    await createChild(b, { childName: 'Bob' });
  });

  it('child_name length is 1 to 40 characters', async () => {
    const p = await createUser('parent');
    await expect(createChild(p, { childName: '   ' })).rejects.toThrow();
    await expect(createChild(p, { childName: 'x'.repeat(41) })).rejects.toThrow();
    await createChild(p, { childName: 'x'.repeat(40) });
    await expect(createChild(p, { displayName: '' })).rejects.toThrow();
    await expect(createChild(p, { displayName: 'x'.repeat(41) })).rejects.toThrow();
  });

  it('changing child_name or parent_id on update is rejected', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const c = await createChild(a, { childName: 'keep' });
    await expect(
      as(a).query(`update public.children set child_name = 'other' where id = $1`, [c]),
    ).rejects.toThrow(/immutable|cannot be changed/);
    await expect(superQuery(`update public.children set parent_id = $2 where id = $1`, [c, b])).rejects.toThrow(
      /immutable|cannot be changed/,
    );
    expect(await as(a).query(`update public.children set display_name = 'ok' where id = $1 returning id`, [c])).toHaveLength(1);
  });

  it('pin must be 4 letters or digits', async () => {
    const p = await createUser('parent');
    for (const pin of ['12', '12345', '12 4', 'ab-1']) {
      await expect(createChild(p, { pin })).rejects.toThrow();
    }
    await createChild(p, { pin: 'aB3z' });
  });

  it('gender and age_band checks', async () => {
    const p = await createUser('parent');
    await expect(createChild(p, { gender: 'x' as 'male' })).rejects.toThrow();
    await expect(createChild(p, { ageBand: '1-2' as '2-5' })).rejects.toThrow();
    await createChild(p, { gender: 'male', ageBand: '5-10' });
    await createChild(p, { gender: 'female', ageBand: '2-5' });
  });

  it('super admin selects and deletes all children', async () => {
    const sa = await createUser('super_admin');
    const a = await createUser('parent');
    const b = await createUser('parent');
    const c1 = await createChild(a);
    await createChild(b);
    expect(await as(sa).query(`select id from public.children`)).toHaveLength(2);
    expect(await as(sa).query(`delete from public.children where id = $1 returning id`, [c1])).toHaveLength(1);
  });

  const SA_INSERT = `insert into public.children (parent_id, child_name, display_name, gender, age_band, pin)
                     values ($1, $2, 'Kid', 'male', '2-5', 'ab12') returning id`;

  it('super admin creates a child for a parent (N16)', async () => {
    const sa = await createUser('super_admin');
    const p = await createUser('parent');
    const rows = await as(sa).query<{ id: string; parent_id: string }>(SA_INSERT.replace('returning id', 'returning id, parent_id'), [p, 'sa-made']);
    expect(rows).toHaveLength(1);
    expect(rows[0].parent_id).toBe(p);
    expect(await superQuery(`select 1 from public.child_settings where child_id = $1`, [rows[0].id])).toHaveLength(1);
  });

  it('super admin cannot create a child for another super admin or a missing user (N16)', async () => {
    const sa = await createUser('super_admin');
    const other = await createUser('super_admin');
    await expect(as(sa).query(SA_INSERT, [other, 'to-sa'])).rejects.toThrow();
    await expect(as(sa).query(SA_INSERT, ['00000000-0000-4000-8000-000000000000', 'to-nobody'])).rejects.toThrow();
  });

  it('super admin edits name, PIN, gender and age, but never the login name (N16)', async () => {
    const sa = await createUser('super_admin');
    const p = await createUser('parent');
    const c = await createChild(p, { childName: 'login1', displayName: 'Old' });
    const rows = await as(sa).query(
      `update public.children set display_name = 'New', pin = 'zz99', gender = 'male', age_band = '5-10' where id = $1 returning id`,
      [c],
    );
    expect(rows).toHaveLength(1);
    const kid = await superQuery<{ display_name: string; pin: string; gender: string; age_band: string }>(
      `select display_name, pin, gender, age_band from public.children where id = $1`,
      [c],
    );
    expect(kid[0]).toEqual({ display_name: 'New', pin: 'zz99', gender: 'male', age_band: '5-10' });
    await expect(
      as(sa).query(`update public.children set child_name = 'other' where id = $1 returning id`, [c]),
    ).rejects.toThrow(/immutable|cannot be changed/);
  });

  it('super admin cannot set or change a child picture (N16)', async () => {
    const sa = await createUser('super_admin');
    const p = await createUser('parent');
    const c = await createChild(p, { avatarPath: 'img/mine.png' });
    const ins = (col: string) =>
      as(sa).query(`insert into public.children (parent_id, child_name, display_name, gender, age_band, pin, ${col})
                    values ($1, $2, 'Kid', 'male', '2-5', 'ab12', 'img/x.png')`, [p, `pic-${col}`]);
    await expect(ins('avatar_path')).rejects.toThrow(/super_admin_media/);
    await expect(ins('celebrate_a_path')).rejects.toThrow(/super_admin_media/);
    await expect(ins('celebrate_b_path')).rejects.toThrow(/super_admin_media/);
    await expect(
      as(sa).query(`update public.children set avatar_path = 'img/new.png' where id = $1 returning id`, [c]),
    ).rejects.toThrow(/super_admin_media/);
    await expect(
      as(sa).query(`update public.children set celebrate_b_path = 'img/new.png' where id = $1 returning id`, [c]),
    ).rejects.toThrow(/super_admin_media/);
    // an edit that leaves the pictures alone is fine, and the picture stays
    expect(await as(sa).query(`update public.children set display_name = 'Ok' where id = $1 returning id`, [c])).toHaveLength(1);
    const kid = await superQuery<{ avatar_path: string }>(`select avatar_path from public.children where id = $1`, [c]);
    expect(kid[0].avatar_path).toBe('img/mine.png');
  });

  it('super admin cannot add a sixth child to a full parent (N16)', async () => {
    const sa = await createUser('super_admin');
    const p = await createUser('parent');
    for (let i = 0; i < 5; i++) await createChild(p);
    await expect(as(sa).query(SA_INSERT, [p, 'sixth'])).rejects.toThrow(/too_many_children/);
  });

  it('a parent can still set their own pictures (the Super Admin rule does not reach parents)', async () => {
    const p = await createUser('parent');
    const c = await createChild(p);
    expect(
      await as(p).query(`update public.children set avatar_path = 'img/mine.png' where id = $1 returning id`, [c]),
    ).toHaveLength(1);
  });

  it('anon has no access', async () => {
    const a = await createUser('parent');
    await createChild(a);
    await expect(as(null).query(`select * from public.children`)).rejects.toThrow(/permission denied/);
    await expect(as(null).query(INSERT, ['anon'])).rejects.toThrow(/permission denied/);
  });

  it('child_settings row is created on child insert and removed on delete', async () => {
    const p = await createUser('parent');
    const c = await createChild(p);
    const rows = await superQuery<{ music_volume: number }>(`select * from public.child_settings where child_id = $1`, [c]);
    expect(rows).toHaveLength(1);
    expect(rows[0].music_volume).toBe(30);
    await superQuery(`delete from public.children where id = $1`, [c]);
    expect(await superQuery(`select 1 from public.child_settings where child_id = $1`, [c])).toEqual([]);
    // deleting the parent cascades to children and their settings
    const c2 = await createChild(p);
    await superQuery(`delete from auth.users where id = $1`, [p]);
    expect(await superQuery(`select 1 from public.children where id = $1`, [c2])).toEqual([]);
    expect(await superQuery(`select 1 from public.child_settings where child_id = $1`, [c2])).toEqual([]);
  });

  it('child_settings no longer has child_name or avatar_path (moved to children)', async () => {
    const cols = await superQuery<{ column_name: string }>(
      `select column_name from information_schema.columns where table_schema = 'public' and table_name = 'child_settings'`,
    );
    const names = cols.map((c) => c.column_name);
    expect(names).not.toContain('child_name');
    expect(names).not.toContain('avatar_path');
    expect(names).toContain('greeting_path');
  });

  it('child_settings follows children RLS (other parent cannot read or update it)', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const sa = await createUser('super_admin');
    const ca = await createChild(a);
    const upd = (u: string) =>
      as(u).query(`update public.child_settings set music_volume = 70 where child_id = $1 returning child_id`, [ca]);
    expect((await as(a).query<{ child_id: string }>(`select child_id from public.child_settings`)).map((r) => r.child_id)).toEqual([ca]);
    expect(await as(b).query(`select * from public.child_settings`)).toEqual([]);
    expect(await upd(b)).toEqual([]);
    expect(await upd(a)).toHaveLength(1);
    expect(await upd(sa)).toHaveLength(1);
    await expect(as(null).query(`select * from public.child_settings`)).rejects.toThrow();
  });

  it("profiles role check rejects 'child'", async () => {
    const id = await createUser('parent');
    await expect(superQuery(`update public.profiles set role = 'child' where user_id = $1`, [id])).rejects.toThrow(/check/);
  });

  it('owner_scope returns the parent id for a parent', async () => {
    const admin = await createUser('super_admin');
    const p = await createUser('parent');
    const scope = async (u: string) =>
      (await as(u).query<{ s: string | null }>(`select public.owner_scope()::text as s`))[0].s;
    expect(await scope(p)).toBe(p);
    expect(await scope(admin)).toBeNull();
  });

  it('profiles has no parent_id column', async () => {
    const r = await superQuery(
      `select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'parent_id'`,
    );
    expect(r).toEqual([]);
  });
});
