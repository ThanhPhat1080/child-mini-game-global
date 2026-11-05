import { vi } from 'vitest';
import { fakeFrom, type QueryResult, type QueryState } from './fakeSupabase';

export const SERVICE_KEY = 'SERVICE-SECRET-KEY-do-not-leak';
export const RAW = 'duplicate key value violates unique constraint "users_email_key"';

export type Caller = 'signedOut' | 'parent' | 'bannedParent' | 'superAdmin' | 'bannedSuperAdmin';

const callerProfiles: Record<Exclude<Caller, 'signedOut'>, object> = {
  parent: { user_id: 'p1', role: 'parent', banned: false, quota_bytes: 0 },
  bannedParent: { user_id: 'p1', role: 'parent', banned: true, quota_bytes: 0 },
  superAdmin: { user_id: 's1', role: 'super_admin', banned: false, quota_bytes: 0 },
  bannedSuperAdmin: { user_id: 's1', role: 'super_admin', banned: true, quota_bytes: 0 },
};

/** Shared state for the mocked server (caller) and service clients of the account-creation routes. */
export function makeHarness() {
  const s = {
    caller: 'parent' as Caller,
    createResult: { data: { user: { id: 'new1' } }, error: null } as { data: unknown; error: unknown },
    updateResult: { data: [{ user_id: 'new1' }], error: null } as QueryResult,
    deleteResult: { data: {}, error: null } as { data: unknown; error: unknown },
  };

  const caller = fakeFrom(() => ({
    data: s.caller === 'signedOut' ? null : callerProfiles[s.caller],
  }));
  const serverClient = {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: s.caller === 'signedOut' ? null : { id: 'caller' } },
        error: null,
      })),
    },
    from: caller.from,
  };

  const service = fakeFrom((q: QueryState): QueryResult => {
    if (q.op === 'update') return s.updateResult;
    return { data: null };
  });
  const createUser = vi.fn(async () => s.createResult);
  const deleteUser = vi.fn(async () => s.deleteResult);
  const serviceClient = { auth: { admin: { createUser, deleteUser } }, from: service.from };

  function reset() {
    s.caller = 'parent';
    s.createResult = { data: { user: { id: 'new1' } }, error: null };
    s.updateResult = { data: [{ user_id: 'new1' }], error: null };
    s.deleteResult = { data: {}, error: null };
    service.queries.length = 0;
    createUser.mockClear();
    deleteUser.mockClear();
  }

  return { s, serverClient, serviceClient, createUser, deleteUser, serviceQueries: service.queries, reset };
}

export function post(url: string, body: unknown) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export async function read(res: Response) {
  const text = await res.text();
  return { status: res.status, text, json: text ? JSON.parse(text) : null };
}
