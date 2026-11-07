import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createUser, resetDb, startDb, stopDb } from './harness';

// Spec A32-A35: the Puzzle Pairs picture list. Everyone reads active rows; only a Super Admin writes.

type Row = { word: string; image_path: string; audio_path: string | null };

describe('puzzle_pictures (A32-A35)', () => {
  let sa: string;
  let parent: string;
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
    sa = await createUser('super_admin');
    parent = await createUser('parent');
  });

  it('seed rows exist', async () => {
    const rows = await as(null).query<Row>(
      `select word, image_path, audio_path from public.puzzle_pictures order by word`,
    );
    expect(rows.map((r) => r.word)).toEqual(['apple', 'fish', 'house', 'triangle']);
    for (const r of rows) {
      expect(r.image_path).toBe(`seed/${r.word}.svg`);
      expect(r.audio_path).toBeNull();
    }
  });

  it('anon and parent read only active rows', async () => {
    const changed = await as(sa).query(
      `update public.puzzle_pictures set active = false where word = 'fish' returning id`,
    );
    expect(changed).toHaveLength(1);
    const count = `select id from public.puzzle_pictures`;
    expect(await as(null).query(count)).toHaveLength(3);
    expect(await as(parent).query(count)).toHaveLength(3);
    expect(await as(sa).query(count)).toHaveLength(4);
  });

  it('parent cannot write', async () => {
    await expect(
      as(parent).query(`insert into public.puzzle_pictures (word, image_path) values ('star', 'x.svg')`),
    ).rejects.toThrow();
    expect(
      await as(parent).query(`update public.puzzle_pictures set word = 'x' returning id`),
    ).toHaveLength(0);
    expect(await as(parent).query(`delete from public.puzzle_pictures returning id`)).toHaveLength(0);
    await expect(
      as(null).query(`insert into public.puzzle_pictures (word, image_path) values ('star', 'x.svg')`),
    ).rejects.toThrow();
    expect(await as(sa).query(`select id from public.puzzle_pictures`)).toHaveLength(4);
  });

  it('super admin writes', async () => {
    const ins = await as(sa).query<{ id: string; owner_id: string }>(
      `insert into public.puzzle_pictures (word, image_path) values ('star', $1) returning id, owner_id`,
      [`${sa}/library/star-x.svg`],
    );
    expect(ins[0].owner_id).toBe(sa);
    expect(
      await as(sa).query(`update public.puzzle_pictures set word = 'sun' where id = $1 returning id`, [ins[0].id]),
    ).toHaveLength(1);
    expect(
      await as(sa).query(`delete from public.puzzle_pictures where id = $1 returning id`, [ins[0].id]),
    ).toHaveLength(1);
  });

  it('word length', async () => {
    const ins = (w: string) =>
      as(sa).query(`insert into public.puzzle_pictures (word, image_path) values ($1, 'x.svg')`, [w]);
    await expect(ins('   ')).rejects.toThrow();
    await expect(ins('a'.repeat(41))).rejects.toThrow();
    await expect(ins('a'.repeat(40))).resolves.toBeDefined();
  });

  it('media_in_use sees both columns', async () => {
    const img = `${sa}/library/star-x.svg`;
    const snd = `${sa}/library/star-y.mp3`;
    await as(sa).query(
      `insert into public.puzzle_pictures (word, image_path, audio_path) values ('star', $1, $2)`,
      [img, snd],
    );
    const inUse = async (p: string) =>
      (await as(sa).query<{ u: boolean }>(`select public.media_in_use($1) u`, [p]))[0].u;
    expect(await inUse(img)).toBe(true);
    expect(await inUse(snd)).toBe(true);
    expect(await inUse(`${sa}/library/unused.svg`)).toBe(false);
  });

  it('media_used_by_others sees seed rows but not the owner', async () => {
    const img = `${sa}/library/star-x.svg`;
    await as(sa).query(`insert into public.puzzle_pictures (word, image_path) values ('star', $1)`, [img]);
    const others = async (p: string) =>
      (await as(sa).query<{ u: boolean }>(`select public.media_used_by_others($1) u`, [p]))[0].u;
    expect(await others(img)).toBe(false);
    expect(await others('seed/fish.svg')).toBe(true);
  });
});
