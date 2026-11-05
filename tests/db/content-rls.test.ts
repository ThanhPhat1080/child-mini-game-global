import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec U3, U5, V1, V5, V6 on the five content tables plus questions/answers.
// "Published" is `status = 'published'` for quiz_sets, `active` elsewhere; card_groups has no
// published notion and counts as always published.

type Vis = 'private' | 'pending' | 'global';

interface Table {
  name: string;
  /** Column list and value list for a minimal valid row. */
  cols: (published: boolean) => { cols: string; vals: string };
  /** SET clause that edits the row without touching owner or visibility. */
  edit: string;
}

const CONTENT_TABLES: Table[] = [
  {
    name: 'quiz_sets',
    cols: (p) => ({ cols: 'title, status', vals: `'t', '${p ? 'published' : 'draft'}'` }),
    edit: `title = 'edited'`,
  },
  {
    name: 'memory_cards',
    cols: (p) => ({ cols: 'word, image_path, active', vals: `'w', 'x.svg', ${p}` }),
    edit: `word = 'edited'`,
  },
  {
    name: 'spot_levels',
    cols: (p) => ({
      cols: 'image_a_path, image_b_path, differences, active',
      vals: `'a.svg', 'b.svg', '[1,2,3]'::jsonb, ${p}`,
    }),
    edit: `sort_order = 9`,
  },
  {
    name: 'card_groups',
    cols: () => ({ cols: 'name', vals: `'g-' || gen_random_uuid()::text` }),
    edit: `name = 'e-' || gen_random_uuid()::text`,
  },
  {
    name: 'find_levels',
    cols: (p) => ({
      cols: 'image_path, objects, active',
      vals: `'f.svg', '[1,2]'::jsonb, ${p}`,
    }),
    edit: `sort_order = 9`,
  },
];

async function seedRow(
  t: Table,
  owner: string | null,
  visibility: Vis,
  published = true,
): Promise<string> {
  const { cols, vals } = t.cols(published);
  const rows = await superQuery<{ id: string }>(
    `insert into public.${t.name} (${cols}, owner_id, visibility)
       values (${vals}, $1, $2::public.visibility) returning id`,
    [owner, visibility],
  );
  return rows[0].id;
}

async function visibleIds(user: string | null, t: Table): Promise<string[]> {
  const rows = await as(user).query<{ id: string }>(`select id from public.${t.name}`);
  return rows.map((r) => r.id);
}

async function ban(userId: string, banned: boolean) {
  await superQuery(`update public.profiles set banned = $2 where user_id = $1`, [userId, banned]);
}

describe('content ownership and RLS (U3, U5, V1, V5, V6)', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
    // The publish gate wants a complete question; these tests care about RLS, not the gate.
    await superQuery('alter table public.quiz_sets disable trigger quiz_sets_publish_gate');
    await superQuery('delete from public.memory_cards');
    await superQuery('delete from public.card_groups');
    await superQuery('delete from public.quiz_sets');
    await superQuery('delete from public.spot_levels');
    await superQuery('delete from public.find_levels');
  });

  describe.each(CONTENT_TABLES)('$name', (t) => {
    it("parent B cannot select parent A's private row", async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const id = await seedRow(t, a, 'private');
      expect(await visibleIds(a, t)).toEqual([id]);
      expect(await visibleIds(b, t)).toEqual([]);
    });

    it('parent edits own private row, cannot edit when pending or global', async () => {
      const a = await createUser('parent');
      const priv = await seedRow(t, a, 'private');
      const pending = await seedRow(t, a, 'pending');
      const global = await seedRow(t, a, 'global');
      const upd = (id: string) =>
        as(a).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [id]);
      expect(await upd(priv)).toHaveLength(1);
      expect(await upd(pending)).toEqual([]);
      expect(await upd(global)).toEqual([]);
      const del = (id: string) =>
        as(a).query(`delete from public.${t.name} where id = $1 returning id`, [id]);
      expect(await del(pending)).toEqual([]);
      expect(await del(global)).toEqual([]);
      expect(await del(priv)).toHaveLength(1);
    });

    it("parent B cannot edit or delete A's row", async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const id = await seedRow(t, a, 'private');
      expect(await as(b).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [id])).toEqual([]);
      expect(await as(b).query(`delete from public.${t.name} where id = $1 returning id`, [id])).toEqual([]);
    });

    it('parent inserts own private row only, and cannot set visibility directly to global', async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const { cols, vals } = t.cols(true);
      const ins = (owner: string, vis: Vis) =>
        as(a).query(
          `insert into public.${t.name} (${cols}, owner_id, visibility)
             values (${vals}, $1, $2::public.visibility) returning id`,
          [owner, vis],
        );
      expect(await ins(a, 'private')).toHaveLength(1);
      await expect(ins(a, 'global')).rejects.toThrow();
      await expect(ins(a, 'pending')).rejects.toThrow();
      await expect(ins(b, 'private')).rejects.toThrow();
    });

    it('owner_id defaults to the caller and visibility to private', async () => {
      const a = await createUser('parent');
      const { cols, vals } = t.cols(true);
      const rows = await as(a).query<{ owner_id: string; visibility: string }>(
        `insert into public.${t.name} (${cols}) values (${vals}) returning owner_id, visibility`,
      );
      expect(rows).toEqual([{ owner_id: a, visibility: 'private' }]);
    });

    it('parent cannot change visibility or owner of own row by update', async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const id = await seedRow(t, a, 'private');
      await expect(
        as(a).query(`update public.${t.name} set visibility = 'global' where id = $1`, [id]),
      ).rejects.toThrow();
      await expect(
        as(a).query(`update public.${t.name} set visibility = 'pending' where id = $1`, [id]),
      ).rejects.toThrow();
      await expect(
        as(a).query(`update public.${t.name} set owner_id = $2 where id = $1`, [id, b]),
      ).rejects.toThrow();
    });

    it('super admin reads and updates everything, including visibility', async () => {
      const sa = await createUser('super_admin');
      const a = await createUser('parent');
      const priv = await seedRow(t, a, 'private');
      const pending = await seedRow(t, a, 'pending');
      const global = await seedRow(t, a, 'global');
      expect((await visibleIds(sa, t)).sort()).toEqual([priv, pending, global].sort());
      expect(await as(sa).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [pending])).toHaveLength(1);
      expect(
        await as(sa).query(`update public.${t.name} set visibility = 'private' where id = $1 returning id`, [global]),
      ).toHaveLength(1);
      expect(await as(sa).query(`delete from public.${t.name} where id = $1 returning id`, [priv])).toHaveLength(1);
    });

    it('rows of a banned owner are invisible to all but super admin and return on unban', async () => {
      const sa = await createUser('super_admin');
      const a = await createUser('parent');
      const b = await createUser('parent');
      const priv = await seedRow(t, a, 'private');
      const global = await seedRow(t, a, 'global');
      await ban(a, true);
      expect(await visibleIds(a, t)).toEqual([]);
      expect(await visibleIds(b, t)).toEqual([]);
      expect((await visibleIds(sa, t)).sort()).toEqual([priv, global].sort());
      await ban(a, false);
      expect(await visibleIds(a, t)).toHaveLength(2);
      expect(await visibleIds(b, t)).toEqual([global]);
    });

    it('a banned parent cannot write, even with a valid session', async () => {
      const a = await createUser('parent');
      const id = await seedRow(t, a, 'private');
      await ban(a, true);
      const { cols, vals } = t.cols(true);
      await expect(
        as(a).query(`insert into public.${t.name} (${cols}) values (${vals})`),
      ).rejects.toThrow();
      expect(await as(a).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [id])).toEqual([]);
      expect(await as(a).query(`delete from public.${t.name} where id = $1 returning id`, [id])).toEqual([]);
    });

    it('anon selects nothing and cannot write', async () => {
      const a = await createUser('parent');
      await seedRow(t, a, 'global');
      expect(await visibleIds(null, t)).toEqual([]);
      const { cols, vals } = t.cols(true);
      await expect(
        as(null).query(`insert into public.${t.name} (${cols}) values (${vals})`),
      ).rejects.toThrow();
    });
  });

  describe('platform rows (owner_id null, e.g. seed content on a fresh project)', () => {
    it.each(CONTENT_TABLES)('$name: published global rows are readable, only super admin edits', async (t) => {
      const sa = await createUser('super_admin');
      const a = await createUser('parent');
      const id = await seedRow(t, null, 'global');
      expect(await visibleIds(a, t)).toEqual([id]);
      expect(await as(a).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [id])).toEqual([]);
      expect(await as(sa).query(`update public.${t.name} set ${t.edit} where id = $1 returning id`, [id])).toHaveLength(1);
    });
  });

  describe('existing rows are backfilled', () => {
    it('is documented by the migration: rows without a Super Admin keep owner_id null and become global', async () => {
      const cols = await superQuery<{ column_name: string; is_nullable: string; column_default: string | null }>(
        `select column_name, is_nullable, column_default from information_schema.columns
          where table_schema = 'public' and table_name = 'quiz_sets'
            and column_name in ('owner_id', 'visibility') order by column_name`,
      );
      expect(cols).toEqual([
        { column_name: 'owner_id', is_nullable: 'YES', column_default: 'auth.uid()' },
        { column_name: 'visibility', is_nullable: 'NO', column_default: "'private'::visibility" },
      ]);
    });
  });

  describe('card ownership follows its group', () => {
    it("a card's owner must equal its group's owner", async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const gA = await seedRow(CONTENT_TABLES[3], a, 'private');
      const ins = (owner: string) =>
        superQuery(
          `insert into public.memory_cards (word, image_path, group_id, owner_id) values ('w', 'x.svg', $1, $2)`,
          [gA, owner],
        );
      await expect(ins(b)).rejects.toThrow(/group_owner_mismatch/);
      await expect(ins(a)).resolves.toBeDefined();
      const cardId = (
        await superQuery<{ id: string }>(`select id from public.memory_cards where owner_id = $1`, [a])
      )[0].id;
      await expect(
        superQuery(`update public.memory_cards set owner_id = $2 where id = $1`, [cardId, b]),
      ).rejects.toThrow(/group_owner_mismatch/);
    });

    it('two parents can both have a group with the same name', async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const mk = (u: string) =>
        as(u).query(`insert into public.card_groups (name) values ('Food') returning id`);
      await expect(mk(a)).resolves.toHaveLength(1);
      await expect(mk(b)).resolves.toHaveLength(1);
      await expect(mk(a)).rejects.toThrow();
    });
  });

  describe('questions and answers follow their set', () => {
    async function setWithQa(owner: string | null, vis: Vis, published = true) {
      const setId = await seedRow(CONTENT_TABLES[0], owner, vis, published);
      const q = await superQuery<{ id: string }>(
        `insert into public.questions (set_id, position) values ($1, 1) returning id`,
        [setId],
      );
      await superQuery(
        `insert into public.answers (question_id, slot, image_path, is_correct) values ($1, 1, 'i.svg', true)`,
        [q[0].id],
      );
      return { setId, questionId: q[0].id };
    }
    const qa = async (user: string | null) => ({
      q: (await as(user).query<{ id: string }>(`select id from public.questions`)).length,
      a: (await as(user).query<{ id: string }>(`select id from public.answers`)).length,
    });

    it('is visible exactly where the set is', async () => {
      const sa = await createUser('super_admin');
      const a = await createUser('parent');
      const b = await createUser('parent');
      await setWithQa(a, 'private');
      expect(await qa(a)).toEqual({ q: 1, a: 1 });
      expect(await qa(b)).toEqual({ q: 0, a: 0 });
      expect(await qa(sa)).toEqual({ q: 1, a: 1 });
      expect(await qa(null)).toEqual({ q: 0, a: 0 });
    });

    it('a global set is visible to every parent, an unpublished one to its owner only', async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      await setWithQa(a, 'global');
      await setWithQa(a, 'global', false);
      expect(await qa(b)).toEqual({ q: 1, a: 1 });
      expect(await qa(a)).toEqual({ q: 2, a: 2 });
    });

    it('hides everything of a banned owner and brings it back on unban', async () => {
      const a = await createUser('parent');
      await setWithQa(a, 'private');
      await ban(a, true);
      expect(await qa(a)).toEqual({ q: 0, a: 0 });
      await ban(a, false);
    });

    it('only the owner of a private set writes its questions and answers', async () => {
      const a = await createUser('parent');
      const b = await createUser('parent');
      const { setId, questionId } = await setWithQa(a, 'private');
      const addQ = (u: string) =>
        as(u).query(`insert into public.questions (set_id, position) values ($1, 2) returning id`, [setId]);
      const addA = (u: string) =>
        as(u).query(
          `insert into public.answers (question_id, slot, image_path) values ($1, 2, 'j.svg') returning id`,
          [questionId],
        );
      await expect(addQ(b)).rejects.toThrow();
      await expect(addA(b)).rejects.toThrow();
      await expect(addQ(a)).resolves.toHaveLength(1);
      await expect(addA(a)).resolves.toHaveLength(1);
    });

    it('questions and answers of a pending or global set are read-only for the owner', async () => {
      const a = await createUser('parent');
      for (const vis of ['pending', 'global'] as const) {
        const { setId, questionId } = await setWithQa(a, vis);
        await expect(
          as(a).query(`insert into public.questions (set_id, position) values ($1, 9)`, [setId]),
        ).rejects.toThrow();
        expect(
          await as(a).query(`update public.questions set prompt_text = 'x' where id = $1 returning id`, [questionId]),
        ).toEqual([]);
        expect(
          await as(a).query(`delete from public.answers where question_id = $1 returning id`, [questionId]),
        ).toEqual([]);
      }
    });

    it('super admin writes any questions and answers', async () => {
      const sa = await createUser('super_admin');
      const a = await createUser('parent');
      const { setId, questionId } = await setWithQa(a, 'global');
      await expect(
        as(sa).query(`insert into public.questions (set_id, position) values ($1, 2) returning id`, [setId]),
      ).resolves.toHaveLength(1);
      expect(
        await as(sa).query(`update public.questions set prompt_text = 'x' where id = $1 returning id`, [questionId]),
      ).toHaveLength(1);
    });
  });
});
