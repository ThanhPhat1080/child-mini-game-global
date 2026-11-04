import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER ONLY. Shared steps of the account-creation route handlers (U8). Every function takes the
 * service-role client; nothing here returns raw Supabase errors to the caller.
 */

export const MAX_CHILDREN = 5;
export const MIN_PASSWORD = 8;
export const MAX_DISPLAY_NAME = 40;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AccountInput = { email: string; password: string; displayName: string };

/** Fixed error codes the routes answer with. Never raw database or Auth text. */
export type AccountError =
  | 'unauthenticated'
  | 'forbidden'
  | 'invalid_body'
  | 'invalid_parent'
  | 'child_limit'
  | 'email_taken'
  | 'failed';

const STATUS: Record<AccountError, number> = {
  unauthenticated: 401,
  forbidden: 403,
  invalid_body: 400,
  invalid_parent: 400,
  child_limit: 409,
  email_taken: 409,
  failed: 500,
};

export function errorResponse(code: AccountError): Response {
  return Response.json({ error: code }, { status: STATUS[code] });
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Email format, password length >= 8, display name 1-40 characters after trimming. */
export function parseAccountInput(body: Record<string, unknown>): AccountInput | null {
  const { email, password, displayName } = body;
  if (typeof email !== 'string' || typeof password !== 'string' || typeof displayName !== 'string') return null;
  const cleanEmail = email.trim().toLowerCase();
  const name = displayName.trim();
  if (!EMAIL.test(cleanEmail)) return null;
  if (password.length < MIN_PASSWORD) return null;
  if (name.length < 1 || [...name].length > MAX_DISPLAY_NAME) return null;
  return { email: cleanEmail, password, displayName: name };
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

/** True when `parentId` names an existing parent profile. */
export async function isParent(service: SupabaseClient, parentId: string): Promise<boolean> {
  const { data, error } = await service.from('profiles').select('user_id, role').eq('user_id', parentId).maybeSingle();
  return !error && (data as { role?: string } | null)?.role === 'parent';
}

/** Null on read failure. */
export async function countChildren(service: SupabaseClient, parentId: string): Promise<number | null> {
  const { count, error } = await service
    .from('profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('parent_id', parentId)
    .eq('role', 'child');
  return error || count == null ? null : count;
}

type MaybeError = { code?: string; message?: string; status?: number } | null | undefined;

function emailTaken(e: MaybeError): boolean {
  if (!e) return false;
  return (
    e.code === 'email_exists' ||
    e.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(e.message ?? '')
  );
}

function updateError(e: MaybeError): AccountError {
  const msg = e?.message ?? '';
  if (/too_many_children/.test(msg)) return 'child_limit';
  if (/child_needs_parent/.test(msg)) return 'invalid_parent';
  return 'failed';
}

/**
 * U8 provisioning: create a confirmed auth user with `policy_version: 'server-provisioned'` (the sign-up
 * trigger then makes a `parent` profile), then update that profile to `finalProfile`. If anything after
 * createUser fails, the auth user is deleted; a failed rollback is logged server-side only.
 */
export async function provisionAccount(
  service: SupabaseClient,
  input: AccountInput,
  finalProfile: Record<string, unknown>,
): Promise<{ ok: true; userId: string } | { ok: false; error: AccountError }> {
  let userId: string;
  try {
    const { data, error } = await service.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { policy_version: 'server-provisioned' },
    });
    if (error || !data?.user) return { ok: false, error: emailTaken(error) ? 'email_taken' : 'failed' };
    userId = data.user.id;
  } catch {
    return { ok: false, error: 'failed' };
  }

  let failure: AccountError;
  try {
    const { data, error } = await service.from('profiles').update(finalProfile).eq('user_id', userId).select('user_id');
    if (!error && Array.isArray(data) && data.length === 1) return { ok: true, userId };
    failure = error ? updateError(error) : 'failed';
  } catch {
    failure = 'failed';
  }

  await rollback(service, userId);
  return { ok: false, error: failure };
}

async function rollback(service: SupabaseClient, userId: string) {
  try {
    const { error } = await service.auth.admin.deleteUser(userId);
    if (error) console.error('[accounts] rollback deleteUser failed', { userId, code: error.code, status: error.status });
  } catch {
    console.error('[accounts] rollback deleteUser threw', { userId });
  }
}
