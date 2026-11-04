import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { as, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

describe('DB harness', () => {
  beforeAll(async () => {
    await startDb();
  });
  afterAll(async () => {
    await stopDb();
  });

  it('applies migrations and isolates roles', async () => {
    await resetDb();
    const tables = await superQuery<{ n: string }>(
      `select count(*)::text as n from information_schema.tables
        where table_schema = 'public' and table_name = 'admins'`,
    );
    expect(tables[0].n).toBe('1');

    const a = await createUser('parent');
    const b = await createUser('parent');
    expect(a).not.toBe(b);

    const anon = await as(null).query<{ role: string; uid: string | null }>(
      `select current_user as role, auth.uid()::text as uid`,
    );
    expect(anon[0]).toEqual({ role: 'anon', uid: null });

    const authed = await as(a).query<{ role: string; uid: string }>(
      `select current_user as role, auth.uid()::text as uid`,
    );
    expect(authed[0]).toEqual({ role: 'authenticated', uid: a });

    // A table granted only to authenticated: anon must be refused.
    await superQuery(`drop table if exists public.rls_probe`);
    await superQuery(`create table public.rls_probe (id int)`);
    // Supabase default privileges grant new tables to anon, so revoke it explicitly.
    await superQuery(`revoke all on public.rls_probe from anon, public`);
    await superQuery(`grant select on public.rls_probe to authenticated`);
    await superQuery(`insert into public.rls_probe values (1)`);
    expect(await as(a).query(`select * from public.rls_probe`)).toHaveLength(1);
    await expect(as(null).query(`select * from public.rls_probe`)).rejects.toThrow(
      /permission denied/,
    );
    await superQuery(`drop table public.rls_probe`);
  });

  it('resetDb clears users', async () => {
    await createUser('parent');
    await resetDb();
    const rows = await superQuery<{ n: string }>(`select count(*)::text as n from auth.users`);
    expect(rows[0].n).toBe('0');
  });

  it.todo('profiles: as(a) can count public.profiles and as(null) cannot read it (Task 2 adds the table)');
});
