import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createChild, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec GU13 / GT3 (Guest Play): anon (a visitor with no account) reads only global, published or
// active content, never a parent's private, pending or draft row, and writes nothing.

type Vis = 'private' | 'pending' | 'global';

interface Table {
  name: string;
  /** Column list and values of a minimal valid row; `live` = published / active. */
  cols: (live: boolean) => { cols: string; vals: string };
  edit: string;
}

const TABLES: Table[] = [
  { name: 'quiz_sets', cols: (p) => ({ cols: 'title, status', vals: `'t', '${p ? 'published' : 'draft'}'` }), edit: `title = 'x'` },
  { name: 'memory_cards', cols: (p) => ({ cols: 'word, image_path, active', vals: `'w', 'x.svg', ${p}` }), edit: `word = 'x'` },
  {
    name: 'spot_levels',
    cols: (p) => ({ cols: 'image_a_path, image_b_path, differences, active', vals: `'a.svg', 'b.svg', '[1,2,3]'::jsonb, ${p}` }),
    edit: `sort_order = 9`,
  },
  { name: 'card_groups', cols: () => ({ cols: 'name', vals: `'g-' || gen_random_uuid()::text` }), edit: `name = 'e'` },
  { name: 'find_levels', cols: (p) => ({ cols: 'image_path, objects, active', vals: `'f.svg', '[1,2]'::jsonb, ${p}` }), edit: `sort_order = 9` },
];

/** card_groups has no published notion, so `live` only matters for the other tables. */
async function seed(t: Table, owner: string, visibility: Vis, live = true): Promise<string> {
  const { cols, vals } = t.cols(live);
  const rows = await superQuery<{ id: string }>(
    `insert into public.${t.name} (${cols}, owner_id, visibility)
       values (${vals}, $1, $2::public.visibility) returning id`,
    [owner, visibility],
  );
  return rows[0].id;
}

async function anonIds(t: Table): Promise<string[]> {
  return (await as(null).query<{ id: string }>(`select id from public.${t.name}`)).map((r) => r.id);
}

/** A quiz set with one question and one answer, for the questions/answers rules. */
async function seedQuiz(owner: string, visibility: Vis, status: 'published' | 'draft'): Promise<{ q: string; a: string }> {
  const [set] = await superQuery<{ id: string }>(
    `insert into public.quiz_sets (title, status, owner_id, visibility) values ('q', $1, $2, $3::public.visibility) returning id`,
    [status, owner, visibility],
  );
  const [q] = await superQuery<{ id: string }>(
    `insert into public.questions (set_id, position) values ($1, 1) returning id`,
    [set.id],
  );
  const [a] = await superQuery<{ id: string }>(
    `insert into public.answers (question_id, slot, image_path, is_correct) values ($1, 1, 'i.svg', true) returning id`,
    [q.id],
  );
  return { q: q.id, a: a.id };
}

describe('guest play: anon reads global content only (GU13, GT3)', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
    await superQuery('alter table public.quiz_sets disable trigger quiz_sets_publish_gate');
    for (const t of ['memory_cards', 'card_groups', 'quiz_sets', 'spot_levels', 'find_levels']) {
      await superQuery(`delete from public.${t}`);
    }
  });

  describe.each(TABLES)('$name', (t) => {
    it(`anon reads a global ${t.name} row that is published or active`, async () => {
      const parent = await createUser('parent');
      const id = await seed(t, parent, 'global', true);
      expect(await anonIds(t)).toEqual([id]);
    });

    it(`anon never reads a private, pending or unpublished ${t.name} row`, async () => {
      const parent = await createUser('parent');
      await seed(t, parent, 'private', true);
      await seed(t, parent, 'pending', true);
      if (t.name !== 'card_groups') await seed(t, parent, 'global', false); // draft or inactive
      expect(await anonIds(t)).toEqual([]);
    });

    it(`anon cannot insert, update or delete ${t.name}`, async () => {
      const parent = await createUser('parent');
      const id = await seed(t, parent, 'global', true);
      const { cols, vals } = t.cols(true);
      await expect(
        as(null).query(`insert into public.${t.name} (${cols}, owner_id, visibility) values (${vals}, $1, 'global') returning id`, [parent]),
      ).rejects.toThrow();
      expect(await as(null).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [id])).toEqual([]);
      expect(await as(null).query(`delete from public.${t.name} where id = $1 returning id`, [id])).toEqual([]);
    });
  });

  it('anon reads questions and answers of a global published set only', async () => {
    const parent = await createUser('parent');
    const live = await seedQuiz(parent, 'global', 'published');
    await seedQuiz(parent, 'private', 'published');
    await seedQuiz(parent, 'global', 'draft');
    const rows = await as(null).query<{ id: string }>(`select id from public.questions`);
    expect(rows.map((r) => r.id)).toEqual([live.q]);
    const answers = await as(null).query<{ id: string }>(`select id from public.answers`);
    expect(answers.map((r) => r.id)).toEqual([live.a]);
  });

  it('anon still reads nothing from children, child_settings or profiles', async () => {
    const parent = await createUser('parent');
    await createChild(parent);
    // anon has no grant there, so a read is refused (0 rows counted); with a grant it would be filtered to 0 rows
    const seen = (sql: string) => as(null).query(sql).then((r) => r.length, () => 0);
    await expect(seen(`select id from public.children`)).resolves.toBe(0);
    await expect(seen(`select user_id from public.profiles`)).resolves.toBe(0);
    await expect(seen(`select child_id from public.child_settings`)).resolves.toBe(0);
  });
});
