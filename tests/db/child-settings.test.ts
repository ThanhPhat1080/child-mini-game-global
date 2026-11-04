import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec U4: one child_settings row per child, replacing the singleton settings table.

type Row = { child_id: string; child_name: string | null; music_volume: number };

describe('child_settings (U4)', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a default row when a child profile is inserted', async () => {
    const p = await createUser('parent');
    const c = await createUser('child', { parentId: p, displayName: 'Hà My' });
    const rows = await superQuery<Row>(`select * from public.child_settings where child_id = $1`, [c]);
    expect(rows).toHaveLength(1);
    expect(rows[0].music_volume).toBe(30);
    expect(rows[0].child_name).toBe('Hà My');
    // parents and super admins get none
    await createUser('super_admin');
    expect(Number((await superQuery<{ n: string }>(`select count(*) n from public.child_settings`))[0].n)).toBe(1);
  });

  it('drops the old singleton settings table', async () => {
    const r = await superQuery<{ t: string | null }>(`select to_regclass('public.settings') as t`);
    expect(r[0].t).toBeNull();
  });

  it('a child reads only their own row', async () => {
    const p = await createUser('parent');
    const c1 = await createUser('child', { parentId: p });
    await createUser('child', { parentId: p });
    const rows = await as(c1).query<Row>(`select * from public.child_settings`);
    expect(rows.map((r) => r.child_id)).toEqual([c1]);
  });

  it('a child cannot update or insert', async () => {
    const p = await createUser('parent');
    const c = await createUser('child', { parentId: p });
    expect(
      await as(c).query(`update public.child_settings set child_name = 'x' where child_id = $1 returning child_id`, [c]),
    ).toEqual([]);
    await expect(
      as(c).query(`insert into public.child_settings (child_id) values ($1)`, [c]),
    ).rejects.toThrow();
  });

  it("a parent reads and updates own children's rows, not others'", async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const ca = await createUser('child', { parentId: a });
    const cb = await createUser('child', { parentId: b });
    expect((await as(a).query<Row>(`select * from public.child_settings`)).map((r) => r.child_id)).toEqual([ca]);
    const upd = (u: string, child: string) =>
      as(u).query(
        `update public.child_settings set child_name = 'Mia', music_volume = 70 where child_id = $1 returning child_id`,
        [child],
      );
    expect(await upd(a, ca)).toHaveLength(1);
    expect(await upd(a, cb)).toEqual([]);
    expect((await as(ca).query<Row>(`select * from public.child_settings`))[0].child_name).toBe('Mia');
  });

  it('a parent cannot move a row to another child', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const ca = await createUser('child', { parentId: a });
    const cb = await createUser('child', { parentId: b });
    await expect(
      as(a).query(`update public.child_settings set child_id = $2 where child_id = $1`, [ca, cb]),
    ).rejects.toThrow();
  });

  it('rejects out-of-range music volume', async () => {
    const a = await createUser('parent');
    const ca = await createUser('child', { parentId: a });
    await expect(
      as(a).query(`update public.child_settings set music_volume = 101 where child_id = $1`, [ca]),
    ).rejects.toThrow();
  });

  it('a banned parent cannot update, and other parents and anon see nothing', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const ca = await createUser('child', { parentId: a });
    await superQuery(`update public.profiles set banned = true where user_id = $1`, [a]);
    expect(
      await as(a).query(`update public.child_settings set child_name = 'x' where child_id = $1 returning child_id`, [ca]),
    ).toEqual([]);
    expect(await as(b).query(`select * from public.child_settings`)).toEqual([]);
    await expect(as(null).query(`select * from public.child_settings`)).rejects.toThrow();
  });

  it('a super admin reads and updates every row', async () => {
    const sa = await createUser('super_admin');
    const a = await createUser('parent');
    const ca = await createUser('child', { parentId: a });
    expect(await as(sa).query(`select * from public.child_settings`)).toHaveLength(1);
    expect(
      await as(sa).query(`update public.child_settings set child_name = 'x' where child_id = $1 returning child_id`, [ca]),
    ).toHaveLength(1);
  });

  it('deleting a child removes the row', async () => {
    const a = await createUser('parent');
    const ca = await createUser('child', { parentId: a });
    await superQuery(`delete from auth.users where id = $1`, [ca]);
    expect(await superQuery(`select 1 from public.child_settings where child_id = $1`, [ca])).toEqual([]);
  });
});
