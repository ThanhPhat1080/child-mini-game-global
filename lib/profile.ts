/**
 * The parent's own profile (spec 2026-11-07, PR1, PR6, PR7): validation of the display name and the phone number.
 * Pure functions here; the data access comes below in the same module.
 */

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
