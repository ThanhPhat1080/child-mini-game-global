import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';

const ROOT = join(__dirname, '..', '..');
const MIGRATIONS = join(ROOT, 'supabase', 'migrations');
const BOOTSTRAP = join(__dirname, 'bootstrap.sql');

// Matches docker-compose.test.yml. scripts/test-rls.sh sets it for its own cluster.
const DEFAULT_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

let pool: Pool | null = null;

function db(): Pool {
  if (!pool) throw new Error('startDb() has not been called');
  return pool;
}

/** Run SQL as the connecting (super)user, outside any RLS role. */
export async function superQuery<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  const res = await db().query(sql, params);
  return res.rows as T[];
}

async function applyMigrations(): Promise<void> {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    try {
      await db().query(readFileSync(join(MIGRATIONS, f), 'utf8'));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
}

/** Connect, add missing Supabase pieces, then start from a fresh database state. */
export async function startDb(): Promise<void> {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.RLS_DATABASE_URL ?? DEFAULT_URL, max: 4 });
  }
  await db().query(readFileSync(BOOTSTRAP, 'utf8'));
  await resetDb();
}

export async function stopDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Wipe public, users and storage rows, then re-apply every migration in order. */
export async function resetDb(): Promise<void> {
  const q = (s: string) => db().query(s);
  await q('drop schema if exists public cascade');
  await q('create schema public');
  await q('grant usage on schema public to anon, authenticated, service_role');
  await q(`alter default privileges in schema public grant all on tables to anon, authenticated, service_role`);
  await q(`alter default privileges in schema public grant all on sequences to anon, authenticated, service_role`);
  await q(`alter default privileges in schema public grant all on functions to anon, authenticated, service_role`);
  // Policies on storage.objects live outside public, so drop them explicitly.
  await q(`do $$ declare p record; begin
    for p in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' loop
      execute format('drop policy %I on storage.objects', p.policyname);
    end loop; end $$`);
  // Replica mode skips triggers, so storage's protect_delete trigger (newer schemas) cannot block this.
  const c = await db().connect();
  try {
    await c.query('begin');
    await c.query('set local session_replication_role = replica');
    await c.query('delete from storage.objects');
    await c.query('delete from storage.buckets');
    await c.query('delete from auth.users');
    await c.query('commit');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  } finally {
    c.release();
  }
  await applyMigrations();
}

export type TestRole = 'super_admin' | 'parent';

/** A raw pooled connection as the (super)user, e.g. to hold a transaction open. Release it. */
export function connect(): Promise<PoolClient> {
  return db().connect();
}

/**
 * Insert a provisioned auth.users row (app metadata `provisioned`, so the sign-up trigger
 * skips it) plus its public.profiles row, the way the server routes do.
 */
export async function createUser(
  role: TestRole,
  opts: { banned?: boolean; displayName?: string; policyVersion?: string } = {},
): Promise<string> {
  const id = randomUUID();
  await db().query(
    `insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, '{"provisioned": true}')`,
    [id, `${role}-${id}@test.local`],
  );
  await db().query(
    `insert into public.profiles
       (user_id, role, banned, display_name, policy_version_accepted, policy_accepted_at)
     values ($1, $2, $3, $4, $5, case when $5::text is null then null else now() end)`,
    [id, role, opts.banned ?? false, opts.displayName ?? null, opts.policyVersion ?? null],
  );
  return id;
}

export type ChildOverrides = {
  childName?: string;
  displayName?: string;
  gender?: 'male' | 'female';
  ageBand?: '2-5' | '5-10';
  pin?: string;
  avatarPath?: string | null;
};

/** Insert a children row for a parent (as the superuser, outside RLS) and return its id. */
export async function createChild(parentId: string, over: ChildOverrides = {}): Promise<string> {
  const id = randomUUID();
  await db().query(
    `insert into public.children (id, parent_id, child_name, display_name, avatar_path, gender, age_band, pin)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      parentId,
      over.childName ?? `kid-${id}`,
      over.displayName ?? 'Kid',
      over.avatarPath ?? null,
      over.gender ?? 'female',
      over.ageBand ?? '2-5',
      over.pin ?? 'ab12',
    ],
  );
  return id;
}

/** Each query runs in its own transaction as role anon (null) or authenticated with the given JWT sub. */
export function as(userId: string | null): {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
} {
  return {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
      const client: PoolClient = await db().connect();
      try {
        await client.query('begin');
        const claims = userId
          ? { sub: userId, role: 'authenticated' }
          : { role: 'anon' };
        await client.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
        await client.query(`set local role ${userId ? 'authenticated' : 'anon'}`);
        const res = await client.query(sql, params);
        await client.query('commit');
        return res.rows as T[];
      } catch (e) {
        await client.query('rollback').catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    },
  };
}
