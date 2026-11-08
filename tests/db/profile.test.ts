import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec PR1-PR5 (parent profile: phone, picture, own-row update) and SA1 (Super Admin reads parent contacts).

describe('parent profile and contacts (PR1-PR5, SA1)', () => {
  let sa: string;
  let a: string;
  let b: string;
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
  });

  it('a parent updates their own name, phone and picture', async () => {
    await as(a).query(`update public.profiles set display_name = 'Lan', phone = '+84 912 345 678', avatar_path = $1 where user_id = $2`, [`${a}/me.webp`, a]);
    const [row] = await superQuery(`select display_name, phone, avatar_path from public.profiles where user_id = $1`, [a]);
    expect(row).toEqual({ display_name: 'Lan', phone: '+84 912 345 678', avatar_path: `${a}/me.webp` });
  });

  it('a parent cannot change role, banned or quota_bytes', async () => {
    await expect(as(a).query(`update public.profiles set banned = true where user_id = $1`, [a])).rejects.toThrow();
    await expect(as(a).query(`update public.profiles set quota_bytes = 1 where user_id = $1`, [a])).rejects.toThrow();
    await expect(as(a).query(`update public.profiles set role = 'super_admin' where user_id = $1`, [a])).rejects.toThrow();
  });

  it('a parent cannot update another profile', async () => {
    const rows = await as(a).query(`update public.profiles set display_name = 'x' where user_id = $1 returning user_id`, [b]);
    expect(rows).toHaveLength(0);
  });

  it('a banned parent cannot update their own profile', async () => {
    await superQuery(`update public.profiles set banned = true where user_id = $1`, [a]);
    const rows = await as(a).query(`update public.profiles set display_name = 'x' where user_id = $1 returning user_id`, [a]);
    expect(rows).toHaveLength(0);
  });

  it('the phone check accepts empty (null) and 8 to 20 digits, rejects letters and short numbers', async () => {
    await expect(as(a).query(`update public.profiles set phone = null where user_id = $1`, [a])).resolves.toBeDefined();
    await expect(as(a).query(`update public.profiles set phone = '0912345678' where user_id = $1`, [a])).resolves.toBeDefined();
    await expect(as(a).query(`update public.profiles set phone = '0912abc678' where user_id = $1`, [a])).rejects.toThrow();
    await expect(as(a).query(`update public.profiles set phone = '1234567' where user_id = $1`, [a])).rejects.toThrow();
  });

  it('a parent can only point their picture into their own folder', async () => {
    await expect(as(a).query(`update public.profiles set avatar_path = $1 where user_id = $2`, [`${a}/me.webp`, a])).resolves.toBeDefined();
    await expect(as(a).query(`update public.profiles set avatar_path = $1 where user_id = $2`, [`${b}/someone-else.webp`, a])).rejects.toThrow();
  });

  it('the display name check rejects a blank name on a new write', async () => {
    await expect(as(a).query(`update public.profiles set display_name = '   ' where user_id = $1`, [a])).rejects.toThrow();
  });

  it('super_admin_parent_contacts returns parents with email for a Super Admin only', async () => {
    const rows = await as(sa).query<{ user_id: string; email: string }>(`select user_id, email from public.super_admin_parent_contacts()`);
    expect(rows.map((r) => r.user_id).sort()).toEqual([a, b].sort());
    expect(rows.every((r) => r.email.endsWith('@test.local'))).toBe(true);
    await expect(as(a).query(`select * from public.super_admin_parent_contacts()`)).rejects.toThrow(/forbidden/);
    await expect(as(null).query(`select * from public.super_admin_parent_contacts()`)).rejects.toThrow();
  });
});
