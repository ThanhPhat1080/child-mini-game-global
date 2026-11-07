/**
 * The signed-in user's own profile (spec 2026-11-07, PR1, PR6-PR8, PR10): validation of the display name and the
 * phone number, and reading and saving the profile row. RLS limits the writes to the own row (PR4, PR5).
 */
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type Client = ReturnType<typeof createSupabaseBrowserClient>;

/** Longest display name, in characters (the same limit as a child's login name). */
export const MAX_NAME = 40;

export const NAME_ERROR = 'Enter your name (1 to 40 characters).';
export const PHONE_HINT = 'Enter a phone number with 8 to 20 digits, for example +84 912 345 678.';

/** Allowed characters and length, after trim. The digit count is checked on top of this. */
const PHONE_PATTERN = /^\+?[0-9 ().-]{8,20}$/;

/** The error text for a display name, or null when it is valid. The name is checked after trim. */
export function validateName(name: string): string | null {
  const n = name.trim();
  return n.length >= 1 && [...n].length <= MAX_NAME ? null : NAME_ERROR;
}

/** The phone as it is stored: trimmed, or null when empty. */
export function normalizePhone(phone: string): string | null {
  const p = phone.trim();
  return p === '' ? null : p;
}

/** The error text for a phone number, or null when it is empty (optional) or valid. */
export function validatePhone(phone: string | null): string | null {
  if (phone === null) return null;
  const p = phone.trim();
  if (p === '') return null;
  if (!PHONE_PATTERN.test(p)) return PHONE_HINT;
  return p.replace(/[^0-9]/g, '').length >= 8 ? null : PHONE_HINT;
}

/** The signed-in user's profile, with the sign-in email read from the account (PR8). */
export type MyProfile = {
  userId: string;
  role: 'parent' | 'super_admin';
  displayName: string;
  phone: string | null;
  avatarPath: string | null;
  email: string;
};

/** The profile of the signed-in user, or null when nobody is signed in or the row is missing. */
export async function loadMyProfile(client: Client = createSupabaseBrowserClient()): Promise<MyProfile | null> {
  const { data: userData } = await client.auth.getUser();
  const user = userData.user;
  if (!user) return null;
  const { data, error } = await client
    .from('profiles')
    .select('display_name, phone, avatar_path, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { display_name: string | null; phone: string | null; avatar_path: string | null; role: MyProfile['role'] };
  return {
    userId: user.id,
    role: row.role,
    displayName: row.display_name ?? '',
    phone: row.phone,
    avatarPath: row.avatar_path,
    email: user.email ?? '',
  };
}

/** Saves name, phone and picture of the signed-in user. Invalid input throws before any request. */
export async function saveMyProfile(
  input: { displayName: string; phone: string | null; avatarPath: string | null },
  client: Client = createSupabaseBrowserClient(),
): Promise<void> {
  const nameError = validateName(input.displayName);
  if (nameError) throw new Error(nameError);
  const phone = input.phone === null ? null : normalizePhone(input.phone);
  const phoneError = validatePhone(phone);
  if (phoneError) throw new Error(phoneError);
  const { data: userData } = await client.auth.getUser();
  if (!userData.user) throw new Error('Not signed in.');
  const { error } = await client
    .from('profiles')
    .update({ display_name: input.displayName.trim(), phone, avatar_path: input.avatarPath })
    .eq('user_id', userData.user.id);
  if (error) throw new Error(error.message);
}
