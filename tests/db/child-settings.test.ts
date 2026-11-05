import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createChild, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec U4 / K5: one child_settings row per children row. Access rules are also covered in children.test.ts.

type Row = { child_id: string; music_volume: number };

describe('child_settings (U4, K5)', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('creates a default row when a child is inserted', async () => {
    const p = await createUser('parent');
    const c = await createChild(p);
    const rows = await superQuery<Row>(`select * from public.child_settings where child_id = $1`, [c]);
    expect(rows).toHaveLength(1);
    expect(rows[0].music_volume).toBe(30);
    // parents and super admins get none
    await createUser('super_admin');
    expect(Number((await superQuery<{ n: string }>(`select count(*) n from public.child_settings`))[0].n)).toBe(1);
  });

  it('drops the old singleton settings table', async () => {
    const r = await superQuery<{ t: string | null }>(`select to_regclass('public.settings') as t`);
    expect(r[0].t).toBeNull();
  });

  it("a parent reads and updates own children's rows, not others'", async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const ca = await createChild(a);
    const cb = await createChild(b);
    expect((await as(a).query<Row>(`select * from public.child_settings`)).map((r) => r.child_id)).toEqual([ca]);
    const upd = (u: string, child: string) =>
      as(u).query(
        `update public.child_settings set greeting_path = 'g.mp3', music_volume = 70 where child_id = $1 returning child_id`,
        [child],
      );
    expect(await upd(a, ca)).toHaveLength(1);
    expect(await upd(a, cb)).toEqual([]);
    expect((await as(a).query<Row>(`select * from public.child_settings`))[0].music_volume).toBe(70);
  });

  it('a parent cannot move a row to another child, nor insert one', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const ca = await createChild(a);
    const cb = await createChild(b);
    await expect(
      as(a).query(`update public.child_settings set child_id = $2 where child_id = $1`, [ca, cb]),
    ).rejects.toThrow();
    await expect(as(a).query(`insert into public.child_settings (child_id) values ($1)`, [cb])).rejects.toThrow();
  });

  it('rejects out-of-range music volume', async () => {
    const a = await createUser('parent');
    const ca = await createChild(a);
    await expect(
      as(a).query(`update public.child_settings set music_volume = 101 where child_id = $1`, [ca]),
    ).rejects.toThrow();
  });

  it('a banned parent cannot update, and other parents and anon see nothing', async () => {
    const a = await createUser('parent');
    const b = await createUser('parent');
    const ca = await createChild(a);
    await superQuery(`update public.profiles set banned = true where user_id = $1`, [a]);
    expect(
      await as(a).query(`update public.child_settings set music_volume = 5 where child_id = $1 returning child_id`, [ca]),
    ).toEqual([]);
    expect(await as(b).query(`select * from public.child_settings`)).toEqual([]);
    await expect(as(null).query(`select * from public.child_settings`)).rejects.toThrow();
  });

  it('a super admin reads and updates every row', async () => {
    const sa = await createUser('super_admin');
    const a = await createUser('parent');
    const ca = await createChild(a);
    expect(await as(sa).query(`select * from public.child_settings`)).toHaveLength(1);
    expect(
      await as(sa).query(`update public.child_settings set music_volume = 9 where child_id = $1 returning child_id`, [ca]),
    ).toHaveLength(1);
  });

  it('deleting a child removes the row', async () => {
    const a = await createUser('parent');
    const ca = await createChild(a);
    await superQuery(`delete from public.children where id = $1`, [ca]);
    expect(await superQuery(`select 1 from public.child_settings where child_id = $1`, [ca])).toEqual([]);
  });
});
