// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeHarness, post, read, RAW, SERVICE_KEY } from './support/apiHarness';

const h = vi.hoisted(() => ({ harness: null as unknown as ReturnType<typeof import('./support/apiHarness').makeHarness> }));

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => h.harness.serverClient }));
vi.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: () => h.harness.serviceClient }));

h.harness = makeHarness();
const { s, createUser, deleteUser, serviceQueries } = h.harness;

import { POST } from '@/app/api/children/route';

const good = { email: 'kid@example.com', password: 'longenough1', displayName: 'childPlayer' };
const call = (body: unknown) => POST(post('http://app.test/api/children', body)).then(read);

beforeEach(() => {
  h.harness.reset();
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/children (U8)', () => {
  it('401 when signed out', async () => {
    s.caller = 'signedOut';
    expect((await call(good)).status).toBe(401);
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each(['child', 'bannedParent'] as const)('403 for %s', async (who) => {
    s.caller = who;
    expect((await call(good)).status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each([
    ['not JSON', '{nope'],
    ['bad email', { ...good, email: 'not-an-email' }],
    ['short password', { ...good, password: 'short7!' }],
    ['empty name', { ...good, displayName: '   ' }],
    ['long name', { ...good, displayName: 'x'.repeat(41) }],
    ['missing fields', { email: good.email }],
  ])('400 for %s', async (_n, body) => {
    expect((await call(body)).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('409 when the parent already has 5 children, before creating anything', async () => {
    s.childCount = 5;
    const r = await call(good);
    expect(r.status).toBe(409);
    expect(createUser).not.toHaveBeenCalled();
    const countQ = serviceQueries.find((q) => q.options?.head);
    expect(countQ?.filters).toEqual(expect.arrayContaining([['parent_id', 'p1']]));
  });

  it('409 when the email is taken', async () => {
    s.createResult = { data: { user: null }, error: { code: 'email_exists', status: 422, message: `${RAW} ${SERVICE_KEY}` } };
    const r = await call(good);
    expect(r.status).toBe(409);
    expect(r.text).not.toContain(SERVICE_KEY);
    expect(r.text).not.toContain('duplicate key');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('409 and rollback when the limit trigger rejects the profile update (race)', async () => {
    s.updateResult = { data: null, error: { code: '23514', message: 'too_many_children: a parent has at most 5 children' } };
    const r = await call(good);
    expect(r.status).toBe(409);
    expect(deleteUser).toHaveBeenCalledWith('new1');
    expect(r.text).not.toContain('too_many_children');
  });

  it('creates the auth user with exactly the provisioning metadata, then sets the child profile', async () => {
    const r = await call({ ...good, email: '  Kid@Example.com ' });
    expect(r.status).toBe(201);
    expect(r.json).toEqual({ childId: 'new1' });
    expect(createUser).toHaveBeenCalledWith({
      email: 'kid@example.com',
      password: 'longenough1',
      email_confirm: true,
      user_metadata: { policy_version: 'server-provisioned' },
    });
    const upd = serviceQueries.find((q) => q.op === 'update');
    expect(upd?.table).toBe('profiles');
    expect(upd?.payload).toEqual({
      role: 'child',
      parent_id: 'p1',
      display_name: 'childPlayer',
      policy_version_accepted: null,
      policy_accepted_at: null,
    });
    expect(upd?.filters).toEqual([['user_id', 'new1']]);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('ignores a parentId sent by a parent', async () => {
    await call({ ...good, parentId: '00000000-0000-4000-8000-000000000009' });
    expect(serviceQueries.find((q) => q.op === 'update')?.payload).toMatchObject({ parent_id: 'p1' });
  });

  it('rolls back the auth user when the profile update fails, without leaking the error', async () => {
    s.updateResult = { data: null, error: { message: `${RAW} ${SERVICE_KEY}` } };
    const r = await call(good);
    expect(r.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('new1');
    expect(r.text).not.toContain(SERVICE_KEY);
    expect(r.text).not.toContain('duplicate key');
  });

  it('rolls back when the update touched no row (profile missing)', async () => {
    s.updateResult = { data: [], error: null };
    expect((await call(good)).status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('new1');
  });

  it('still answers with a clean error when the rollback itself fails', async () => {
    s.updateResult = { data: null, error: { message: 'boom' } };
    s.deleteResult = { data: null, error: { message: `rollback ${SERVICE_KEY}` } };
    const r = await call(good);
    expect(r.status).toBe(500);
    expect(r.text).not.toContain(SERVICE_KEY);
    expect(console.error).toHaveBeenCalled();
  });

  it('500 without leaking when createUser fails for another reason', async () => {
    s.createResult = { data: { user: null }, error: { status: 500, message: `${RAW} ${SERVICE_KEY}` } };
    const r = await call(good);
    expect(r.status).toBe(500);
    expect(r.text).not.toContain(SERVICE_KEY);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  describe('DB guard error mapping (contract with the profiles migration)', () => {
    it.each([
      ['message prefix', { code: '23514', message: 'too_many_children: a parent has at most 5 children' }, 409],
      ['details prefix', { code: '23514', message: 'check failed', details: 'too_many_children: limit 5' }, 409],
      ['hint prefix', { code: '23514', message: 'check failed', hint: 'child_needs_parent: set parent_id' }, 400],
      ['token anywhere in message, other code', { code: 'P0001', message: 'ERROR: too_many_children (5)' }, 409],
      ['child_needs_parent prefix', { code: '23514', message: 'child_needs_parent: parent_id must point to a parent profile' }, 400],
      ['unknown 23514 text', { code: '23514', message: 'some_other_rule: nope', details: 'detail text' }, 500],
      ['23514 token not at start of details', { code: '23514', message: 'x', details: 'not too_many_children' }, 500],
    ])('%s: rollback, fixed status, no DB text', async (_n, error, status) => {
      s.updateResult = { data: null, error };
      const r = await call(good);
      expect(r.status).toBe(status);
      expect(deleteUser).toHaveBeenCalledWith('new1');
      expect(r.text).not.toMatch(/too_many_children|child_needs_parent|some_other_rule|detail text|check failed/);
      if (status === 500) expect(r.json).toEqual({ error: 'failed' });
    });
  });

  describe('password and name rules', () => {
    it('400 when GoTrue rejects a weak password, no rollback needed', async () => {
      s.createResult = { data: { user: null }, error: { code: 'weak_password', status: 422, message: 'Password is known to be weak' } };
      const r = await call(good);
      expect(r.status).toBe(400);
      expect(r.json).toEqual({ error: 'invalid_body' });
      expect(deleteUser).not.toHaveBeenCalled();
    });

    it('400 for another password policy error', async () => {
      s.createResult = { data: { user: null }, error: { status: 422, message: 'Password should contain at least one digit' } };
      expect((await call(good)).status).toBe(400);
    });

    it('accepts a 72-byte password, rejects 73+ bytes (UTF-8)', async () => {
      expect((await call({ ...good, password: 'a'.repeat(72) })).status).toBe(201);
      expect((await call({ ...good, password: 'a'.repeat(73) })).status).toBe(400);
      expect((await call({ ...good, password: 'é'.repeat(37) })).status).toBe(400); // 37 chars, 74 bytes
    });

    it.each([['newline', 'Hà\nMy'], ['bell', 'Hà\u0007My'], ['C1 control', 'Hà\u0085My']])('400 for a name with a %s', async (_n, displayName) => {
      expect((await call({ ...good, displayName })).status).toBe(400);
      expect(createUser).not.toHaveBeenCalled();
    });
  });

  it('logs server-side and answers 500 when createUser throws', async () => {
    createUser.mockImplementationOnce(async () => {
      throw new Error(`network ${SERVICE_KEY}`);
    });
    const r = await call(good);
    expect(r.status).toBe(500);
    expect(r.text).not.toContain(SERVICE_KEY);
    expect(console.error).toHaveBeenCalled();
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(SERVICE_KEY);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('kid@example.com');
  });

  describe('as super admin', () => {
    const parentId = '00000000-0000-4000-8000-000000000009';

    it('400 without parentId', async () => {
      s.caller = 'superAdmin';
      expect((await call(good)).status).toBe(400);
      expect(createUser).not.toHaveBeenCalled();
    });

    it('400 when parentId is not a parent', async () => {
      s.caller = 'superAdmin';
      s.targetParent = null;
      expect((await call({ ...good, parentId })).status).toBe(400);
      expect(createUser).not.toHaveBeenCalled();
    });

    it('creates a child for the named parent', async () => {
      s.caller = 'superAdmin';
      const r = await call({ ...good, parentId });
      expect(r.status).toBe(201);
      expect(serviceQueries.find((q) => q.op === 'update')?.payload).toMatchObject({ role: 'child', parent_id: parentId });
    });

    it('a banned super admin is still allowed', async () => {
      s.caller = 'bannedSuperAdmin';
      expect((await call({ ...good, parentId })).status).toBe(201);
    });
  });
});
