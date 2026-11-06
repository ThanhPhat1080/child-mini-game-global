import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createChild, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec 2026-11-06-review-copy (V8-V13): approve creates a Super Admin copy; the original goes back to private.

type Table = 'quiz_sets' | 'memory_cards' | 'card_groups' | 'spot_levels' | 'find_levels';

const png = (size: number) => JSON.stringify({ mimetype: 'image/png', size });
const upload = (u: string, name: string) =>
  as(u).query(`insert into storage.objects (bucket_id, name, metadata) values ('media', $1, $2::jsonb) returning name`, [name, png(10)]);

// The columns that must be copied verbatim (media paths and jsonb).
const COLS: Record<Table, string> = {
  quiz_sets: 'title, cover_path',
  memory_cards: 'word, image_path, audio_path',
  card_groups: 'name',
  spot_levels: 'image_a_path, image_b_path, differences',
  find_levels: 'image_path, objects',
};

/** A row of each table owned by `owner`, with the pictures and sounds the copy must keep. */
async function make(table: Table, owner: string, vis: 'private' | 'pending' = 'private'): Promise<string> {
  if (table === 'quiz_sets') {
    const [s] = await superQuery<{ id: string }>(
      `insert into public.quiz_sets (title, owner_id, cover_path, visibility) values ('Animals', $1, $2, $3::public.visibility) returning id`,
      [owner, `${owner}/cover.png`, vis],
    );
    const [q] = await superQuery<{ id: string }>(
      `insert into public.questions (set_id, position, prompt_text, prompt_image_path, prompt_audio_path)
         values ($1, 1, 'Which?', $2, $3) returning id`,
      [s.id, `${owner}/q.png`, `${owner}/q.mp3`],
    );
    await superQuery(
      `insert into public.answers (question_id, slot, image_path, is_correct)
         values ($1, 1, $2, true), ($1, 2, $3, false)`,
      [q.id, `${owner}/a1.png`, `${owner}/a2.png`],
    );
    await superQuery(`update public.quiz_sets set status = 'published' where id = $1`, [s.id]);
    return s.id;
  }
  if (table === 'card_groups') {
    const [g] = await superQuery<{ id: string }>(
      `insert into public.card_groups (name, owner_id, visibility) values ('Animals', $1, $2::public.visibility) returning id`,
      [owner, vis],
    );
    return g.id;
  }
  if (table === 'memory_cards') {
    const [c] = await superQuery<{ id: string }>(
      `insert into public.memory_cards (word, image_path, audio_path, owner_id, visibility)
         values ('cat', $1, $2, $3, $4::public.visibility) returning id`,
      [`${owner}/img.png`, `${owner}/snd.mp3`, owner, vis],
    );
    return c.id;
  }
  if (table === 'spot_levels') {
    const [l] = await superQuery<{ id: string }>(
      `insert into public.spot_levels (image_a_path, image_b_path, differences, owner_id, visibility)
         values ($1, $2, '[{"x":1,"y":1},{"x":2,"y":2},{"x":3,"y":3}]'::jsonb, $3, $4::public.visibility) returning id`,
      [`${owner}/a.png`, `${owner}/b.png`, owner, vis],
    );
    return l.id;
  }
  const [f] = await superQuery<{ id: string }>(
    `insert into public.find_levels (image_path, objects, owner_id, visibility)
       values ($1, '[{"word":"cat"},{"word":"dog"}]'::jsonb, $2, $3::public.visibility) returning id`,
    [`${owner}/find.png`, owner, vis],
  );
  return f.id;
}

const row = async (table: string, id: string) =>
  (await superQuery<Record<string, unknown>>(`select * from public.${table} where id = $1`, [id]))[0];

describe('review copy (V8-V13)', () => {
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

  const share = (u: string, table: Table, id: string) =>
    as(u).query(`select public.share_item($1, $2)`, [table, id]);
  const approve = async (table: Table, id: string) =>
    (await as(sa).query<{ id: string }>(`select public.review_approve($1, $2) as id`, [table, id]))[0].id;

  describe.each<Table>(['quiz_sets', 'memory_cards', 'card_groups', 'spot_levels', 'find_levels'])('approve on %s', (table) => {
    it('creates a Super Admin global copy with the same media and source_id; the original goes private', async () => {
      const id = await make(table, a);
      await share(a, table, id);
      const copyId = await approve(table, id);

      const copy = await row(table, copyId);
      expect(copy.owner_id).toBe(sa);
      expect(copy.visibility).toBe('global');
      expect(copy.source_id).toBe(id);
      expect(copy.source_owner_id).toBe(a);

      const orig = await row(table, id);
      expect(orig.visibility).toBe('private');
      expect(orig.owner_id).toBe(a);

      const cols = COLS[table];
      const pick = async (rid: string) =>
        (await superQuery<Record<string, unknown>>(`select ${cols} from public.${table} where id = $1`, [rid]))[0];
      expect(await pick(copyId)).toEqual(await pick(id));
    });
  });

  it('a quiz copy has the same question and answer counts, and is published', async () => {
    const id = await make('quiz_sets', a);
    await share(a, 'quiz_sets', id);
    const copyId = await approve('quiz_sets', id);
    const counts = async (set: string) =>
      (await superQuery<{ q: number; an: number }>(
        `select count(distinct q.id)::int q, count(an.id)::int an
           from public.questions q left join public.answers an on an.question_id = q.id
          where q.set_id = $1`,
        [set],
      ))[0];
    expect(await counts(copyId)).toEqual(await counts(id));
    expect((await row('quiz_sets', copyId)).status).toBe('published');
  });

  it('a card copy gets a Super Admin group with the same name; the original group stays the parent\'s', async () => {
    const group = await make('card_groups', a, 'private');
    await superQuery(`update public.card_groups set visibility = 'private' where id = $1`, [group]);
    const card = await make('memory_cards', a);
    await superQuery(`update public.memory_cards set group_id = $1 where id = $2`, [group, card]);
    await share(a, 'memory_cards', card);

    const copyId = await approve('memory_cards', card);
    const copy = await row('memory_cards', copyId);
    const copyGroup = await row('card_groups', copy.group_id as string);
    expect(copyGroup.owner_id).toBe(sa);
    expect(copyGroup.name).toBe('Animals');
    expect(copyGroup.visibility).toBe('global');
    expect((await row('card_groups', group)).owner_id).toBe(a);
  });

  it('the parent can still edit the original, and the copy is unchanged', async () => {
    const id = await make('memory_cards', a);
    await share(a, 'memory_cards', id);
    const copyId = await approve('memory_cards', id);
    const edited = await as(a).query<{ word: string }>(
      `update public.memory_cards set word = 'dog' where id = $1 returning word`,
      [id],
    );
    expect(edited).toEqual([{ word: 'dog' }]);
    expect((await row('memory_cards', copyId)).word).toBe('cat');
  });

  it('deleting the original leaves the copy intact, and a file the copy uses cannot be deleted', async () => {
    const id = await make('memory_cards', a);
    await upload(a, `${a}/img.png`);
    await share(a, 'memory_cards', id);
    const copyId = await approve('memory_cards', id);

    await as(a).query(`delete from public.memory_cards where id = $1`, [id]);
    expect(await row('memory_cards', id)).toBeUndefined();
    const copy = await row('memory_cards', copyId);
    expect(copy.source_id).toBeNull();
    expect(copy.image_path).toBe(`${a}/img.png`);

    const gone = await as(a).query(
      `delete from storage.objects where bucket_id = 'media' and name = $1 returning name`,
      [`${a}/img.png`],
    );
    expect(gone).toEqual([]);
  });

  it('renaming a file that a copy uses is refused; an unused file can still be renamed', async () => {
    const id = await make('memory_cards', a);
    await upload(a, `${a}/img.png`);
    await upload(a, `${a}/free.png`);
    await share(a, 'memory_cards', id);
    await approve('memory_cards', id);

    const rename = (from: string, to: string) =>
      as(a).query(
        `update storage.objects set name = $2 where bucket_id = 'media' and name = $1 returning name`,
        [from, to],
      );
    expect(await rename(`${a}/img.png`, `${a}/renamed.png`)).toEqual([]);
    expect(await rename(`${a}/free.png`, `${a}/free2.png`)).toEqual([{ name: `${a}/free2.png` }]);
  });

  it('publish_own works for a Super Admin on their own private row and is refused for a parent', async () => {
    const mine = await make('memory_cards', sa, 'private');
    await as(sa).query(`select public.publish_own('memory_cards', $1)`, [mine]);
    expect((await row('memory_cards', mine)).visibility).toBe('global');

    const theirs = await make('memory_cards', a, 'private');
    await expect(as(a).query(`select public.publish_own('memory_cards', $1)`, [theirs])).rejects.toThrow(/forbidden/);
    await expect(as(sa).query(`select public.publish_own('memory_cards', $1)`, [theirs])).rejects.toThrow();
    expect((await row('memory_cards', theirs)).visibility).toBe('private');
  });

  it('clients cannot call copy_content_as directly', async () => {
    const id = await make('memory_cards', a);
    await expect(
      as(sa).query(`select public.copy_content_as('memory_cards', $1, $2)`, [id, sa]),
    ).rejects.toThrow(/permission denied/);
  });

  it('the backfill turns a parent\'s existing global row into a copy and sends the original private', async () => {
    // The backfill block is in the migration; run that exact SQL against a parent's global row.
    const migration = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20261106010000_review_copy.sql'),
      'utf8',
    );
    const start = migration.indexOf('-- backfill:start');
    const end = migration.indexOf('-- backfill:end');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const id = await make('spot_levels', a, 'private');
    await superQuery(`update public.spot_levels set visibility = 'global' where id = $1`, [id]);

    await superQuery(migration.slice(start, end));

    const copies = await superQuery<{ id: string; owner_id: string; visibility: string }>(
      `select id, owner_id, visibility::text from public.spot_levels where source_id = $1`,
      [id],
    );
    expect(copies).toHaveLength(1);
    expect(copies[0].owner_id).toBe(sa);
    expect(copies[0].visibility).toBe('global');
    expect((await row('spot_levels', id)).visibility).toBe('private');
  });
});
