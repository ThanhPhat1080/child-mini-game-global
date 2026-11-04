// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeHarness, post, read, RAW, SERVICE_KEY } from './support/apiHarness';

const h = vi.hoisted(() => ({ harness: null as unknown as ReturnType<typeof import('./support/apiHarness').makeHarness> }));

vi.mock('@/lib/supabase/server', () => ({ createSupabaseServerClient: async () => h.harness.serverClient }));
vi.mock('@/lib/supabase/service', () => ({ createSupabaseServiceClient: () => h.harness.serviceClient }));

h.harness = makeHarness();
const { s, createUser, deleteUser, serviceQueries } = h.harness;

import { POST } from '@/app/api/users/route';

const parentId = '00000000-0000-4000-8000-000000000009';
const base = { email: 'new@example.com', password: 'longenough1', displayName: 'New one' };
const call = (body: unknown) => POST(post('http://app.test/api/users', body)).then(read);
const update = () => serviceQueries.find((q) => q.op === 'update');

beforeEach(() => {
  h.harness.reset();
  s.caller = 'superAdmin';
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE_KEY;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('POST /api/users (U8)', () => {
  it('401 when signed out', async () => {
    s.caller = 'signedOut';
    expect((await call({ ...base, role: 'parent' })).status).toBe(401);
  });

  it.each(['child', 'parent', 'bannedParent'] as const)('403 for %s', async (who) => {
    s.caller = who;
    expect((await call({ ...base, role: 'parent' })).status).toBe(403);
    expect(createUser).not.toHaveBeenCalled();
  });

  it.each([['admin'], [''], [undefined], ['SUPER_ADMIN']])('400 for role %s', async (role) => {
    expect((await call({ ...base, role })).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('400 for a child without parentId', async () => {
    expect((await call({ ...base, role: 'child' })).status).toBe(400);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('400 for a bad email / short password', async () => {
    expect((await call({ ...base, role: 'parent', email: 'x' })).status).toBe(400);
    expect((await call({ ...base, role: 'parent', password: '1234567' })).status).toBe(400);
  });

  it('creates a parent: provisioning metadata, then display_name only', async () => {
    const r = await call({ ...base, role: 'parent' });
    expect(r.status).toBe(201);
    expect(r.json).toEqual({ userId: 'new1' });
    expect(createUser).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'longenough1',
      email_confirm: true,
      user_metadata: { policy_version: 'server-provisioned' },
    });
    expect(update()?.payload).toEqual({ display_name: 'New one' });
  });

  it('creates a super admin', async () => {
    expect((await call({ ...base, role: 'super_admin' })).status).toBe(201);
    expect(update()?.payload).toEqual({
      role: 'super_admin',
      display_name: 'New one',
      policy_version_accepted: null,
      policy_accepted_at: null,
    });
  });

  it('creates a child for a parent', async () => {
    expect((await call({ ...base, role: 'child', parentId })).status).toBe(201);
    expect(update()?.payload).toEqual({
      role: 'child',
      parent_id: parentId,
      display_name: 'New one',
      policy_version_accepted: null,
      policy_accepted_at: null,
    });
  });

  it('409 for a child when the parent already has 5', async () => {
    s.childCount = 5;
    expect((await call({ ...base, role: 'child', parentId })).status).toBe(409);
    expect(createUser).not.toHaveBeenCalled();
  });

  it('409 when the email is taken', async () => {
    s.createResult = { data: { user: null }, error: { code: 'email_exists', message: RAW } };
    expect((await call({ ...base, role: 'parent' })).status).toBe(409);
  });

  it('rolls back when the profile update fails, without leaking', async () => {
    s.updateResult = { data: null, error: { message: `${RAW} ${SERVICE_KEY}` } };
    const r = await call({ ...base, role: 'super_admin' });
    expect(r.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith('new1');
    expect(r.text).not.toContain(SERVICE_KEY);
    expect(r.text).not.toContain('duplicate key');
  });
});
