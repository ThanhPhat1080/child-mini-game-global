import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, connect, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec U1, U2, U5, U6. Note: `current_role` is an SQL keyword, so the function is always
// called schema-qualified: public.current_role().

async function signUp(meta: Record<string, unknown>, appMeta: Record<string, unknown> = {}) {
  const id = randomUUID();
  await superQuery(
    `insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values ($1, $2, $3, $4)`,
    [id, `u-${id}@test.local`, JSON.stringify(meta), JSON.stringify(appMeta)],
  );
  return id;
}

async function count(sql: string, params?: unknown[]): Promise<number> {
  const rows = await superQuery<Record<string, string>>(sql, params);
  return Number(Object.values(rows[0])[0]);
}

async function provisionedUser(): Promise<string> {
  const id = randomUUID();
  await superQuery(
    `insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, '{"provisioned": true}')`,
    [id, `p-${id}@test.local`],
  );
  return id;
}

describe('profiles (U1, U2, U6)', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });
  beforeEach(async () => {
    await resetDb();
  });

  it('has the U1 columns with the right defaults', async () => {
    const cols = await superQuery<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'profiles' order by column_name`,
    );
    expect(cols.map((c) => c.column_name)).toEqual(
      [
        'ban_note',
        'ban_reason_code',
        'banned',
        'banned_at',
        'created_at',
        'display_name',
        'parent_id',
        'policy_accepted_at',
        'policy_version_accepted',
        'quota_bytes',
        'role',
        'user_id',
      ],
    );
    const p = await createUser('parent');
    const [row] = await superQuery<{ banned: boolean; quota_bytes: string; created_at: Date | null }>(
      `select banned, quota_bytes::text, created_at from public.profiles where user_id = $1`,
      [p],
    );
    expect(row.banned).toBe(false);
    expect(row.quota_bytes).toBe('52428800');
    expect(row.created_at).not.toBeNull();
    await expect(
      superQuery(`update public.profiles set role = 'owner' where user_id = $1`, [p]),
    ).rejects.toThrow();
  });

  it('deleting the auth user deletes the profile', async () => {
    const p = await createUser('parent');
    await superQuery(`delete from auth.users where id = $1`, [p]);
    expect(await count(`select count(*) from public.profiles where user_id = $1`, [p])).toBe(0);
  });

  describe('sign-up trigger', () => {
    it('creates a parent profile storing the accepted policy version', async () => {
      const id = await signUp({ policy_version: '2026-11-01' });
      const rows = await superQuery<{
        role: string;
        parent_id: string | null;
        policy_version_accepted: string;
        policy_accepted_at: Date | null;
      }>(
        `select role, parent_id, policy_version_accepted, policy_accepted_at
           from public.profiles where user_id = $1`,
        [id],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].role).toBe('parent');
      expect(rows[0].parent_id).toBeNull();
      expect(rows[0].policy_version_accepted).toBe('2026-11-01');
      expect(rows[0].policy_accepted_at).not.toBeNull();
    });

    it.each([
      [{ policy_version: 'v1', role: 'super_admin' }],
      [{ policy_version: 'v1', role: 'parent' }],
      [{ policy_version: 'v1', role: null }],
      [{ policy_version: 'v1', parent_id: randomUUID() }],
      [{ policy_version: 'v1', parent_id: null }],
    ])('raises forbidden_metadata for %j and creates neither user nor profile', async (meta) => {
      await expect(signUp(meta)).rejects.toThrow(/forbidden_metadata/);
      expect(await count(`select count(*) from auth.users`)).toBe(0);
      expect(await count(`select count(*) from public.profiles`)).toBe(0);
    });

    it.each([[{}], [{ policy_version: '' }], [{ policy_version: '   ' }], [{ policy_version: null }]])(
      'raises without a policy_version (%j) and creates nothing',
      async (meta) => {
        await expect(signUp(meta)).rejects.toThrow(/policy_version/);
        expect(await count(`select count(*) from auth.users`)).toBe(0);
        expect(await count(`select count(*) from public.profiles`)).toBe(0);
      },
    );

    it('creates no profile for a provisioned user (server route inserts it)', async () => {
      const id = await signUp({}, { provisioned: true });
      expect(await count(`select count(*) from auth.users where id = $1`, [id])).toBe(1);
      expect(await count(`select count(*) from public.profiles where user_id = $1`, [id])).toBe(0);
      // Even role metadata is ignored on the provisioned path: it never creates a profile.
      const id2 = await signUp({ role: 'super_admin' }, { provisioned: 'true' });
      expect(await count(`select count(*) from public.profiles where user_id = $1`, [id2])).toBe(0);
    });
  });

  describe('role and parent rules', () => {
    it('a child must have a parent, and that parent must have role parent', async () => {
      const c = await provisionedUser();
      await expect(
        superQuery(`insert into public.profiles (user_id, role) values ($1, 'child')`, [c]),
      ).rejects.toThrow(/parent/);
      const admin = await createUser('super_admin');
      await expect(
        superQuery(`insert into public.profiles (user_id, role, parent_id) values ($1, 'child', $2)`, [
          c,
          admin,
        ]),
      ).rejects.toThrow(/parent/);
      const p = await createUser('parent');
      const other = await createUser('child', { parentId: p });
      await expect(
        superQuery(`insert into public.profiles (user_id, role, parent_id) values ($1, 'child', $2)`, [
          c,
          other,
        ]),
      ).rejects.toThrow(/parent/);
      await superQuery(`insert into public.profiles (user_id, role, parent_id) values ($1, 'child', $2)`, [
        c,
        p,
      ]);
    });

    it('roles other than child have no parent_id', async () => {
      const p = await createUser('parent');
      for (const role of ['parent', 'super_admin']) {
        const u = await provisionedUser();
        await expect(
          superQuery(`insert into public.profiles (user_id, role, parent_id) values ($1, $2, $3)`, [
            u,
            role,
            p,
          ]),
        ).rejects.toThrow(/parent_id/);
      }
      const c = await createUser('child', { parentId: p });
      await expect(
        superQuery(`update public.profiles set role = 'parent' where user_id = $1`, [c]),
      ).rejects.toThrow(/parent_id/);
    });

    it('a parent with children cannot stop being a parent', async () => {
      const p = await createUser('parent');
      await createUser('child', { parentId: p });
      await expect(
        superQuery(`update public.profiles set role = 'super_admin' where user_id = $1`, [p]),
      ).rejects.toThrow(/children/);
    });

    it('a parent gets at most 5 children; the 6th insert fails', async () => {
      const p = await createUser('parent');
      for (let i = 0; i < 5; i++) await createUser('child', { parentId: p });
      await expect(createUser('child', { parentId: p })).rejects.toThrow(/at most 5 children/);
      // Moving another parent's child onto a full parent fails too.
      const p2 = await createUser('parent');
      const c2 = await createUser('child', { parentId: p2 });
      await expect(
        superQuery(`update public.profiles set parent_id = $1 where user_id = $2`, [p, c2]),
      ).rejects.toThrow(/at most 5 children/);
      // Updating an existing child of a full parent (same parent) is fine.
      const [first] = await superQuery<{ user_id: string }>(
        `select user_id from public.profiles where parent_id = $1 limit 1`,
        [p],
      );
      await superQuery(`update public.profiles set display_name = 'x' where user_id = $1`, [first.user_id]);
      expect(await count(`select count(*) from public.profiles where parent_id = $1`, [p])).toBe(5);
    });

    it('two concurrent inserts for the 5th slot: exactly one wins', async () => {
      const p = await createUser('parent');
      for (let i = 0; i < 4; i++) await createUser('child', { parentId: p });
      const c5 = await provisionedUser();
      const c6 = await provisionedUser();
      const a = await connect();
      const b = await connect();
      try {
        await a.query('begin');
        await b.query('begin');
        await a.query(`insert into public.profiles (user_id, role, parent_id) values ($1, 'child', $2)`, [
          c5,
          p,
        ]);
        const bPid = (await b.query<{ pid: number }>('select pg_backend_pid() as pid')).rows[0].pid;
        const bInsert = b
          .query(`insert into public.profiles (user_id, role, parent_id) values ($1, 'child', $2)`, [c6, p])
          .then(
            () => null,
            (e: Error) => e,
          );
        // Wait until b is blocked on a's advisory lock, then let a commit.
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
        expect(err?.message).toMatch(/at most 5 children/);
        await b.query('rollback');
      } finally {
        a.release();
        b.release();
      }
      expect(await count(`select count(*) from public.profiles where parent_id = $1`, [p])).toBe(5);
    });
  });

  describe('helper functions (U2)', () => {
    it('current_role returns the role, or null with no profile or anon', async () => {
      const admin = await createUser('super_admin');
      const p = await createUser('parent');
      const c = await createUser('child', { parentId: p });
      const nobody = await provisionedUser();
      const role = async (u: string | null) =>
        (await as(u).query<{ r: string | null }>(`select public.current_role() as r`))[0].r;
      expect(await role(admin)).toBe('super_admin');
      expect(await role(p)).toBe('parent');
      expect(await role(c)).toBe('child');
      expect(await role(nobody)).toBeNull();
      expect(await role(null)).toBeNull();
    });

    it('owner_scope returns self for parent, parent_id for child, null for super_admin', async () => {
      const admin = await createUser('super_admin');
      const p = await createUser('parent');
      const c = await createUser('child', { parentId: p });
      const nobody = await provisionedUser();
      const scope = async (u: string | null) =>
        (await as(u).query<{ s: string | null }>(`select public.owner_scope()::text as s`))[0].s;
      expect(await scope(p)).toBe(p);
      expect(await scope(c)).toBe(p);
      expect(await scope(admin)).toBeNull();
      expect(await scope(nobody)).toBeNull();
      expect(await scope(null)).toBeNull();
    });

    it('is_banned reads profiles.banned (false for unknown users)', async () => {
      const p = await createUser('parent', { banned: true });
      const q = await createUser('parent');
      const banned = async (u: string) =>
        (await as(q).query<{ b: boolean }>(`select public.is_banned($1) as b`, [u]))[0].b;
      expect(await banned(p)).toBe(true);
      expect(await banned(q)).toBe(false);
      expect(await banned(randomUUID())).toBe(false);
    });

    it('is_admin is current_role() = super_admin and ignores the old admins table', async () => {
      const admin = await createUser('super_admin');
      const p = await createUser('parent');
      await superQuery(`insert into public.admins (user_id) values ($1)`, [p]);
      const isAdmin = async (u: string | null) =>
        (await as(u).query<{ a: boolean }>(`select public.is_admin() as a`))[0].a;
      expect(await isAdmin(admin)).toBe(true);
      expect(await isAdmin(p)).toBe(false);
      expect(await isAdmin(null)).toBe(false);
    });

    it('helpers are security definer, stable, with a pinned search_path', async () => {
      const rows = await superQuery<{ proname: string; prosecdef: boolean; provolatile: string; cfg: string[] }>(
        `select proname, prosecdef, provolatile, proconfig as cfg from pg_proc
          where pronamespace = 'public'::regnamespace
            and proname in ('current_role', 'owner_scope', 'is_banned', 'is_admin') order by proname`,
      );
      expect(rows.map((r) => r.proname)).toEqual(['current_role', 'is_admin', 'is_banned', 'owner_scope']);
      for (const r of rows) {
        expect(r.prosecdef).toBe(true);
        expect(r.provolatile).toBe('s');
        expect(r.cfg?.some((s) => s.startsWith('search_path='))).toBe(true);
      }
    });
  });

  describe('RLS on profiles', () => {
    it('a user reads only their own profile; a parent also reads their children', async () => {
      const p = await createUser('parent');
      const c1 = await createUser('child', { parentId: p });
      const c2 = await createUser('child', { parentId: p });
      const other = await createUser('parent');
      const otherChild = await createUser('child', { parentId: other });
      await createUser('super_admin');
      const ids = async (u: string | null) =>
        (await as(u).query<{ user_id: string }>(`select user_id from public.profiles`))
          .map((r) => r.user_id)
          .sort();
      expect(await ids(p)).toEqual([p, c1, c2].sort());
      expect(await ids(c1)).toEqual([c1]);
      expect(await ids(other)).toEqual([other, otherChild].sort());
    });

    it('a super admin reads all profiles', async () => {
      const admin = await createUser('super_admin');
      const p = await createUser('parent');
      await createUser('child', { parentId: p });
      const rows = await as(admin).query(`select user_id from public.profiles`);
      expect(rows).toHaveLength(3);
    });

    it('anon sees nothing', async () => {
      await createUser('parent');
      await expect(as(null).query(`select * from public.profiles`)).rejects.toThrow(/permission denied/);
      const rows = await as(null).query<{ r: string | null }>(`select public.current_role() as r`);
      expect(rows[0].r).toBeNull();
    });

    it('a client cannot read or write another profile, nor write its own', async () => {
      const admin = await createUser('super_admin');
      const p = await createUser('parent');
      const other = await createUser('parent');
      const c = await createUser('child', { parentId: p });
      expect(await as(p).query(`select * from public.profiles where user_id = $1`, [other])).toHaveLength(0);
      for (const u of [p, c, admin]) {
        await expect(
          as(u).query(`update public.profiles set banned = false, role = 'super_admin' where user_id = $1`, [u]),
        ).rejects.toThrow(/permission denied/);
        await expect(
          as(u).query(`update public.profiles set display_name = 'x' where user_id = $1`, [other]),
        ).rejects.toThrow(/permission denied/);
        await expect(as(u).query(`delete from public.profiles where user_id = $1`, [other])).rejects.toThrow(
          /permission denied/,
        );
        const fresh = await provisionedUser();
        await expect(
          as(u).query(`insert into public.profiles (user_id, role) values ($1, 'parent')`, [fresh]),
        ).rejects.toThrow(/permission denied/);
      }
      const [row] = await superQuery<{ role: string; display_name: string | null }>(
        `select role, display_name from public.profiles where user_id = $1`,
        [other],
      );
      expect(row).toEqual({ role: 'parent', display_name: null });
    });

    it('service_role bypasses RLS and can write profiles', async () => {
      const u = await provisionedUser();
      const c = await connect();
      try {
        await c.query('begin');
        await c.query('set local role service_role');
        await c.query(`insert into public.profiles (user_id, role) values ($1, 'super_admin')`, [u]);
        const rows = await c.query(`select user_id from public.profiles`);
        expect(rows.rows).toHaveLength(1);
        await c.query('commit');
      } finally {
        c.release();
      }
    });
  });
});
