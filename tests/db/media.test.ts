import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, connect, createChild, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec Q1-Q6: owner folders, per-owner quota, safe delete.

const MB = 1024 * 1024;
const png = (size: number) => JSON.stringify({ mimetype: 'image/png', size });

const upload = (u: string, name: string, size: number, meta = png(size)) =>
  as(u).query(`insert into storage.objects (bucket_id, name, metadata) values ('media', $1, $2::jsonb) returning name`, [name, meta]);

describe('media folders, quota and delete guard (Q1-Q6)', () => {
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
    sa = await createUser('super_admin');
    a = await createUser('parent');
    b = await createUser('parent');
    child = await createChild(a);
  });

  it('parents and Super Admins write under their own folder only', async () => {
    await expect(upload(a, `${a}/x.png`, 10)).resolves.toHaveLength(1);
    await expect(upload(sa, `${sa}/x.png`, 10)).resolves.toHaveLength(1);
    await expect(upload(a, `${b}/x.png`, 10)).rejects.toThrow();
    await expect(upload(a, `x.png`, 10)).rejects.toThrow();
    await expect(upload(a, `seed/x.png`, 10)).rejects.toThrow();
  });

  it('a banned parent cannot upload', async () => {
    await superQuery(`update public.profiles set banned = true where user_id = $1`, [a]);
    await expect(upload(a, `${a}/y.png`, 10)).rejects.toThrow();
  });

  it('keeps the image size and type rules', async () => {
    await expect(upload(a, `${a}/big.png`, 3 * MB)).rejects.toThrow();
    await expect(upload(a, `${a}/doc.pdf`, 10, JSON.stringify({ mimetype: 'application/pdf', size: 10 }))).rejects.toThrow();
    await expect(upload(a, `${a}/s.mp3`, MB, JSON.stringify({ mimetype: 'audio/mpeg', size: MB }))).resolves.toHaveLength(1);
  });

  it('every signed-in user can read any file, anon policy unchanged', async () => {
    await upload(a, `${a}/x.png`, 10);
    expect(await as(b).query(`select name from storage.objects`)).toHaveLength(1);
  });

  describe('quota', () => {
    it('storage_used sums the owner folder', async () => {
      await upload(a, `${a}/1.png`, 100);
      await upload(a, `${a}/2.png`, 250);
      await upload(b, `${b}/1.png`, 999);
      const r = await superQuery<{ n: string }>(`select public.storage_used($1) n`, [a]);
      expect(Number(r[0].n)).toBe(350);
    });

    it('rejects a file that would exceed the 50 MB default quota', async () => {
      for (let i = 0; i < 25; i++) await upload(a, `${a}/${i}.png`, 2 * MB);
      await expect(upload(a, `${a}/over.png`, 1)).rejects.toThrow(/quota_exceeded/);
      // another owner is unaffected
      await expect(upload(b, `${b}/ok.png`, 2 * MB)).resolves.toHaveLength(1);
    });

    it('follows set_quota', async () => {
      await as(sa).query(`select public.set_quota($1, 500)`, [a]);
      await expect(upload(a, `${a}/1.png`, 400)).resolves.toHaveLength(1);
      await expect(upload(a, `${a}/2.png`, 101)).rejects.toThrow(/quota_exceeded/);
      await as(sa).query(`select public.set_quota($1, 600)`, [a]);
      await expect(upload(a, `${a}/2.png`, 101)).resolves.toHaveLength(1);
    });

    it('two concurrent uploads that together exceed it: one fails', async () => {
      await superQuery(`update public.profiles set quota_bytes = 1000 where user_id = $1`, [a]);
      const ins = async (name: string) => {
        const c = await connect();
        await c.query('begin');
        return {
          run: () =>
            c.query(`insert into storage.objects (bucket_id, name, metadata) values ('media', $1, $2::jsonb)`, [name, png(600)]),
          commit: () => c.query('commit'),
          rollback: () => c.query('rollback'),
          release: () => c.release(),
        };
      };
      const t1 = await ins(`${a}/1.png`);
      const t2 = await ins(`${a}/2.png`);
      await t1.run();
      const second = t2.run().then(
        () => 'ok',
        (e: Error) => e.message,
      );
      await new Promise((r) => setTimeout(r, 300)); // t2 now waits on the owner lock
      await t1.commit();
      expect(await second).toMatch(/quota_exceeded/);
      await t2.rollback();
      t1.release();
      t2.release();
      const r = await superQuery<{ n: string }>(`select count(*) n from storage.objects where name like $1`, [`${a}/%`]);
      expect(Number(r[0].n)).toBe(1);
    });
  });

  describe('delete guard', () => {
    it('media_in_use sees every content table, ignoring RLS', async () => {
      const own = `${a}/own.png`;
      await superQuery(
        `insert into public.memory_cards (word, image_path, audio_path, owner_id, visibility) values ('w', $1, $2, $3, 'global')`,
        [own, `${a}/own.mp3`, a],
      );
      await superQuery(
        `insert into public.find_levels (image_path, objects, owner_id, visibility) values ('f.png', $1::jsonb, $2, 'private')`,
        [JSON.stringify([{ audio_path: `${a}/obj.mp3` }, {}]), a],
      );
      await superQuery(`update public.children set avatar_path = $2 where id = $1`, [child, `${a}/avatar.png`]);
      await superQuery(`update public.children set celebrate_a_path = $2, celebrate_b_path = $3 where id = $1`, [child, `${a}/cel-a.png`, `${a}/cel-b.png`]);
      for (const p of [own, `${a}/own.mp3`, `${a}/obj.mp3`, `${a}/avatar.png`, `${a}/cel-a.png`, `${a}/cel-b.png`]) {
        expect((await as(b).query<{ r: boolean }>(`select public.media_in_use($1) r`, [p]))[0].r).toBe(true);
      }
      expect((await as(b).query<{ r: boolean }>(`select public.media_in_use($1) r`, [`${a}/free.png`]))[0].r).toBe(false);
    });

    it('refuses to delete a file used by someone else\'s global row, allows unused ones', async () => {
      const used = `${a}/used.png`;
      const free = `${a}/free.png`;
      await upload(a, used, 10);
      await upload(a, free, 10);
      await superQuery(
        `insert into public.memory_cards (word, image_path, owner_id, visibility) values ('w', $1, $2, 'global')`,
        [used, a],
      );
      const del = (u: string, n: string) =>
        as(u).query(`delete from storage.objects where bucket_id = 'media' and name = $1 returning name`, [n]);
      expect(await del(a, used)).toEqual([]);
      expect(await del(sa, used)).toEqual([]);
      expect(await del(b, free)).toEqual([]); // not their folder
      expect(await del(a, free)).toHaveLength(1);
    });
  });

});
