import { describe, expect, it, vi } from 'vitest';
import { createChild, deleteChild, getChildForPlay, listMyChildren, updateChild, validateChild } from '@/lib/children';

const base = { child_name: 'lan', display_name: 'Lan', avatar_path: null, gender: 'female', age_band: '2-5', pin: 'aB3z' } as const;
const row = { id: 'i1', parent_id: 'p1', ...base };

/** A chainable fake: every method returns the chain; awaiting or maybeSingle/single resolves `result`. */
function fake(result: { data?: unknown; error?: unknown }) {
  const calls: Record<string, unknown[][]> = {};
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'insert', 'update', 'delete', 'eq', 'order']) {
    chain[m] = (...a: unknown[]) => ((calls[m] ??= []).push(a), chain);
  }
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (ok: (v: unknown) => unknown, err: (e: unknown) => unknown) => Promise.resolve(result).then(ok, err);
  return { client: chain as never, calls };
}

describe('validateChild (K7)', () => {
  it('accepts a good pin and rejects bad ones', () => {
    expect(validateChild({ ...base }, 'create')).toEqual({});
    expect(validateChild({ ...base, pin: '123' }, 'create').pin).toBeTruthy();
    expect(validateChild({ ...base, pin: '12 4' }, 'create').pin).toBeTruthy();
  });
  it('requires display_name and limits child_name to 40', () => {
    expect(validateChild({ ...base, display_name: ' ' }, 'create').display_name).toBeTruthy();
    expect(validateChild({ ...base, child_name: 'a'.repeat(41) }, 'create').child_name).toBeTruthy();
    expect(validateChild({ ...base, child_name: 'a'.repeat(40) }, 'create').child_name).toBeUndefined();
  });
  it('normalizes whitespace in child_name', () => {
    expect(validateChild({ ...base, child_name: '\tLan' }, 'create').child_name).toBeUndefined();
    expect(validateChild({ ...base, child_name: '\t \n' }, 'create').child_name).toBeTruthy();
    expect(validateChild({ ...base, child_name: 'a  b\tc' + 'x'.repeat(34) }, 'create').child_name).toBeUndefined();
  });
  it('edit mode ignores child_name', () => {
    expect(validateChild({ ...base, child_name: '' }, 'edit').child_name).toBeUndefined();
  });
  it('checks gender and age band', () => {
    expect(validateChild({ ...base, gender: undefined }, 'create').gender).toBeTruthy();
    expect(validateChild({ ...base, age_band: 'x' as never }, 'create').age_band).toBeTruthy();
  });
});

describe('createChild', () => {
  it('inserts normalized, without parent_id, and returns the row', async () => {
    const { client, calls } = fake({ data: row, error: null });
    const r = await createChild({ ...base, child_name: '\t La   n ' }, client);
    expect(r).toEqual({ ok: true, child: row });
    expect(calls.insert[0][0]).toEqual({ ...base, celebrate_a_path: null, celebrate_b_path: null, child_name: 'La n' });
    expect(calls.insert[0][0]).not.toHaveProperty('parent_id');
  });
  it('sends parent_id only when a Super Admin passes one (N16)', async () => {
    const { client, calls } = fake({ data: row, error: null });
    await createChild({ ...base }, client, 'p1');
    expect(calls.insert[0][0]).toMatchObject({ parent_id: 'p1' });
  });
  it('maps 23505 to name_taken', async () => {
    const { client } = fake({ error: { code: '23505', message: 'dup' } });
    expect(await createChild({ ...base }, client)).toEqual({ ok: false, error: 'name_taken' });
  });
  it('maps 23514 too_many_children to child_limit', async () => {
    const { client } = fake({ error: { code: '23514', message: 'too_many_children: max 5' } });
    expect(await createChild({ ...base }, client)).toEqual({ ok: false, error: 'child_limit' });
  });
  it('maps other errors (even 23514 without the token) to failed without leaking text', async () => {
    for (const error of [{ code: '42501', message: 'secret detail' }, { code: '23514', message: 'pin check' }]) {
      const { client } = fake({ error });
      const r = await createChild({ ...base }, client);
      expect(r).toEqual({ ok: false, error: 'failed' });
      expect(JSON.stringify(r)).not.toContain('secret');
    }
  });
});

describe('children reads include created_at (N10, N15)', () => {
  it('selects created_at with the other columns', async () => {
    const { client, calls } = fake({ data: [row], error: null });
    await listMyChildren(client);
    expect(calls.select[0][0]).toContain('created_at');
  });
});

describe('updateChild / deleteChild / reads', () => {
  it('never sends child_name or parent_id', async () => {
    const { client, calls } = fake({ error: null });
    const r = await updateChild('i1', { display_name: 'X', child_name: 'zzz', parent_id: 'q' } as never, client);
    expect(r).toEqual({ ok: true });
    expect(calls.update[0][0]).toEqual({ display_name: 'X' });
    expect(calls.eq[0]).toEqual(['id', 'i1']);
  });
  it('update maps 23505 to name_taken and others to failed', async () => {
    expect(await updateChild('i1', {}, fake({ error: { code: '23505' } }).client)).toEqual({ ok: false, error: 'name_taken' });
    expect(await updateChild('i1', {}, fake({ error: { code: 'x', message: 'm' } }).client)).toEqual({ ok: false, error: 'failed' });
  });
  it('deleteChild failure gives failed', async () => {
    expect(await deleteChild('i1', fake({ error: { message: 'no' } }).client)).toEqual({ ok: false, error: 'failed' });
    expect(await deleteChild('i1', fake({ error: null }).client)).toEqual({ ok: true });
  });
  it('listMyChildren orders by created_at and throws on error', async () => {
    const { client, calls } = fake({ data: [row], error: null });
    expect(await listMyChildren(client)).toEqual([row]);
    expect(calls.order[0][0]).toBe('created_at');
    await expect(listMyChildren(fake({ error: { message: 'x' } }).client)).rejects.toThrow();
  });
  it('getChildForPlay returns the row or null', async () => {
    expect(await getChildForPlay('i1', fake({ data: row, error: null }).client)).toEqual(row);
    expect(await getChildForPlay('i1', fake({ data: null, error: null }).client)).toBeNull();
  });
});
void vi;
