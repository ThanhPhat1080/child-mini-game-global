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
  await q('delete from storage.objects');
  await q('delete from storage.buckets');
  await q('delete from auth.users');
  await applyMigrations();
}

export type TestRole = 'super_admin' | 'parent' | 'child';

/** Insert an auth.users row (and a public.profiles row once that table exists). */
export async function createUser(
  role: TestRole,
  opts: { parentId?: string; banned?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  await db().query('insert into auth.users (id, email) values ($1, $2)', [id, `${role}-${id}@test.local`]);
  const has = await db().query(`select to_regclass('public.profiles') as t`);
  if (has.rows[0].t) {
    // Column names follow spec U1; Task 2 owns the table and may adjust this insert.
    await db().query(
      `insert into public.profiles (user_id, role, parent_id, banned) values ($1, $2, $3, $4)`,
      [id, role, opts.parentId ?? null, opts.banned ?? false],
    );
  }
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
