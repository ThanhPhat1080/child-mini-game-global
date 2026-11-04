import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * SERVER ONLY. Shared steps of the account-creation route handlers (U8). Every function takes the
 * service-role client; nothing here returns raw Supabase errors to the caller.
 */

export const MAX_CHILDREN = 5;
export const MIN_PASSWORD = 8;
export const MAX_DISPLAY_NAME = 40;
/** bcrypt (GoTrue) only uses the first 72 bytes of a password; longer ones are rejected, not truncated. */
export const MAX_PASSWORD_BYTES = 72;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
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
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return null;
  if (name.length < 1 || [...name].length > MAX_DISPLAY_NAME || CONTROL.test(name)) return null;
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

type MaybeError =
  | { code?: string; message?: string; status?: number; details?: string; hint?: string }
  | null
  | undefined;

function emailTaken(e: MaybeError): boolean {
  if (!e) return false;
  return (
    e.code === 'email_exists' ||
    e.code === 'user_already_exists' ||
    /already (been )?registered|already exists/i.test(e.message ?? '')
  );
}

/** GoTrue password-policy rejections (too short, too weak, leaked) are the caller's input problem. */
function weakPassword(e: MaybeError): boolean {
  if (!e) return false;
  return e.code === 'weak_password' || ((e.status === 400 || e.status === 422) && /password/i.test(e.message ?? ''));
}

/**
 * CONTRACT with the profiles guard trigger in supabase/migrations/20261104000000_profiles_roles.sql
 * (owned by the DB task): it raises SQLSTATE 23514 with a message that starts with one of these tokens.
 * Keep the two lists in sync. A token counts when the code is 23514 and message, details or hint starts
 * with it, or when the message contains it anywhere. Anything else is an unknown failure (500, rollback).
 */
const GUARD_TOKENS: [RegExp, RegExp, AccountError][] = [
  [/^too_many_children\b/, /too_many_children/, 'child_limit'],
  [/^child_needs_parent\b/, /child_needs_parent/, 'invalid_parent'],
];

function updateError(e: MaybeError): AccountError {
  const fields = [e?.message, e?.details, e?.hint].filter((f): f is string => typeof f === 'string');
  for (const [prefix, anywhere, code] of GUARD_TOKENS) {
    if (e?.code === '23514' && fields.some((f) => prefix.test(f.trim()))) return code;
    if (anywhere.test(e?.message ?? '')) return code;
  }
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
    if (error || !data?.user) {
      if (emailTaken(error)) return { ok: false, error: 'email_taken' };
      if (weakPassword(error)) return { ok: false, error: 'invalid_body' };
      console.error('[accounts] createUser failed', { code: error?.code, status: error?.status });
      return { ok: false, error: 'failed' };
    }
    userId = data.user.id;
  } catch (e) {
    console.error('[accounts] createUser threw', { name: e instanceof Error ? e.name : typeof e });
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
