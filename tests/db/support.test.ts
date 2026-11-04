import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { as, createUser, resetDb, startDb, stopDb, superQuery } from './harness';

// Spec U17: contact the Super Admin.

describe('support_messages (U17)', () => {
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
    child = await createUser('child', { parentId: a });
  });

  const send = (u: string | null, body: string) =>
    as(u).query<{ id: string; from_user: string }>(
      `insert into public.support_messages (body) values ($1) returning id, from_user`,
      [body],
    );

  it('a banned parent inserts a message for themselves and reads only their own', async () => {
    await superQuery(`update public.profiles set banned = true where user_id = $1`, [a]);
    const [m] = await send(a, 'Please unban me');
    expect(m.from_user).toBe(a);
    await send(b, 'hello');
    const mine = await as(a).query<{ body: string }>(`select body from public.support_messages`);
    expect(mine).toEqual([{ body: 'Please unban me' }]);
  });

  it('cannot send as someone else', async () => {
    await expect(
      as(a).query(`insert into public.support_messages (from_user, body) values ($1, 'x')`, [b]),
    ).rejects.toThrow();
  });

  it('the 6th message in one day raises, other users are unaffected', async () => {
    for (let i = 0; i < 5; i++) await send(a, `m${i}`);
    await expect(send(a, 'm5')).rejects.toThrow(/rate_limited/);
    await expect(send(b, 'ok')).resolves.toHaveLength(1);
  });

  it('older messages do not count toward the limit', async () => {
    for (let i = 0; i < 5; i++) await send(a, `m${i}`);
    await superQuery(`update public.support_messages set created_at = now() - interval '2 days' where from_user = $1`, [a]);
    await expect(send(a, 'again')).resolves.toHaveLength(1);
  });

  it('a body over 2000 characters or empty raises', async () => {
    await expect(send(a, 'x'.repeat(2001))).rejects.toThrow();
    await expect(send(a, '   ')).rejects.toThrow();
    await expect(send(a, 'x'.repeat(2000))).resolves.toHaveLength(1);
  });

  it('super admin reads all and sets read_at and resolved_at', async () => {
    const [m] = await send(a, 'one');
    await send(b, 'two');
    expect(await as(sa).query(`select id from public.support_messages`)).toHaveLength(2);
    const r = await as(sa).query<{ read_at: Date; resolved_at: Date }>(
      `update public.support_messages set read_at = now(), resolved_at = now() where id = $1 returning read_at, resolved_at`,
      [m.id],
    );
    expect(r[0].read_at).toBeInstanceOf(Date);
    expect(r[0].resolved_at).toBeInstanceOf(Date);
    const seen = await as(a).query<{ read_at: Date | null }>(`select read_at from public.support_messages`);
    expect(seen[0].read_at).toBeInstanceOf(Date);
  });

  it('super admin cannot edit the body or the sender', async () => {
    const [m] = await send(a, 'one');
    await expect(
      as(sa).query(`update public.support_messages set body = 'changed' where id = $1`, [m.id]),
    ).rejects.toThrow();
    await expect(
      as(sa).query(`update public.support_messages set from_user = $2 where id = $1`, [m.id, b]),
    ).rejects.toThrow();
  });

  it('other parents, children and anon cannot read, insert, update or delete', async () => {
    const [m] = await send(a, 'private');
    expect(await as(b).query(`select id from public.support_messages`)).toEqual([]);
    expect(await as(child).query(`select id from public.support_messages`)).toEqual([]);
    await expect(send(child, 'hi')).rejects.toThrow();
    await expect(send(sa, 'hi')).rejects.toThrow();
    await expect(send(null, 'hi')).rejects.toThrow();
    await expect(as(null).query(`select id from public.support_messages`)).rejects.toThrow();
    for (const u of [a, b, child]) {
      expect(
        await as(u).query(`update public.support_messages set read_at = now() where id = $1 returning id`, [m.id]),
      ).toEqual([]);
    }
    await expect(as(a).query(`delete from public.support_messages where id = $1`, [m.id])).rejects.toThrow();
  });
});
