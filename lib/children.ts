import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AgeBand, Gender } from '@/lib/childTheme';

export type Child = {
  id: string;
  parent_id: string;
  child_name: string;
  display_name: string;
  avatar_path: string | null;
  gender: Gender;
  age_band: AgeBand;
  pin: string;
};
export type NewChild = Pick<Child, 'child_name' | 'display_name' | 'avatar_path' | 'gender' | 'age_band' | 'pin'>;
export type ChildError = 'name_taken' | 'child_limit' | 'failed';

type Client = ReturnType<typeof createSupabaseBrowserClient>;

const MAX_NAME = 40;
const PIN = /^[A-Za-z0-9]{4}$/;
const COLUMNS = 'id, parent_id, child_name, display_name, avatar_path, gender, age_band, pin';

/** Trim and collapse any run of whitespace (tabs, newlines too) to one space. Matches the DB unique index. */
export function normalizeChildName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

export function validateChild(input: Partial<NewChild>, mode: 'create' | 'edit'): Partial<Record<keyof NewChild, string>> {
  const errors: Partial<Record<keyof NewChild, string>> = {};
  if (mode === 'create') {
    const name = normalizeChildName(input.child_name ?? '');
    if (!name) errors.child_name = 'Enter a login name.';
    else if ([...name].length > MAX_NAME) errors.child_name = `The login name can have at most ${MAX_NAME} characters.`;
  }
  const display = (input.display_name ?? '').trim();
  if (!display) errors.display_name = 'Enter a display name.';
  else if ([...display].length > MAX_NAME) errors.display_name = `The display name can have at most ${MAX_NAME} characters.`;
  if (input.gender !== 'male' && input.gender !== 'female') errors.gender = 'Choose boy or girl.';
  if (input.age_band !== '2-5' && input.age_band !== '5-10') errors.age_band = 'Choose an age band.';
  if (!PIN.test(input.pin ?? '')) errors.pin = 'The PIN must be exactly 4 letters or digits.';
  return errors;
}

type PgError = { code?: string; message?: string } | null | undefined;

function mapError(e: PgError): ChildError {
  if (e?.code === '23505') return 'name_taken';
  if (e?.code === '23514' && /^\s*too_many_children/.test(e.message ?? '')) return 'child_limit';
  return 'failed';
}

/** `parentId` limits the list to one parent's children (a Super Admin can read every family's rows through RLS). */
export async function listMyChildren(client: Client = createSupabaseBrowserClient(), parentId?: string): Promise<Child[]> {
  let q = client.from('children').select(COLUMNS);
  if (parentId) q = q.eq('parent_id', parentId);
  const { data, error } = await q.order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as Child[];
}

/** `parent_id` is left to the column default (auth.uid()). */
export async function createChild(
  input: NewChild,
  client: Client = createSupabaseBrowserClient(),
): Promise<{ ok: true; child: Child } | { ok: false; error: ChildError }> {
  try {
    const row = {
      child_name: normalizeChildName(input.child_name),
      display_name: input.display_name.trim(),
      avatar_path: input.avatar_path,
      gender: input.gender,
      age_band: input.age_band,
      pin: input.pin,
    };
    const { data, error } = await client.from('children').insert(row).select(COLUMNS).single();
    if (error || !data) return { ok: false, error: mapError(error) };
    return { ok: true, child: data as Child };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function updateChild(
  id: string,
  patch: Partial<Omit<NewChild, 'child_name'>>,
  client: Client = createSupabaseBrowserClient(),
): Promise<{ ok: true } | { ok: false; error: ChildError }> {
  try {
    const { child_name: _n, parent_id: _p, id: _i, ...rest } = patch as Record<string, unknown>;
    const { error } = await client.from('children').update(rest).eq('id', id);
    return error ? { ok: false, error: mapError(error) } : { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

export async function deleteChild(
  id: string,
  client: Client = createSupabaseBrowserClient(),
): Promise<{ ok: true } | { ok: false; error: 'failed' }> {
  try {
    const { error } = await client.from('children').delete().eq('id', id);
    return error ? { ok: false, error: 'failed' } : { ok: true };
  } catch {
    return { ok: false, error: 'failed' };
  }
}

/** One child by id, or null when it does not exist or RLS hides it. */
export async function getChildForPlay(id: string, client: Client = createSupabaseBrowserClient()): Promise<Child | null> {
  const { data, error } = await client.from('children').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Child | null) ?? null;
}
