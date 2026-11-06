/**
 * Pure helpers for the Super Admin people pages (N10-N12, N15, N17). No I/O, so they are unit-tested on their own.
 */

const MB = 1024 * 1024;

/** 1-2 uppercase letters: the first letter of the first word and of the last word. "?" when there is no name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = [...words[0]][0] ?? '';
  const last = words.length > 1 ? [...words[words.length - 1]][0] ?? '' : '';
  return (first + last).toUpperCase();
}

export type SortOrder = 'newest' | 'az';

/** A copy of `rows`, newest first or A to Z by name. `pick` says which created date and name to use. */
export function sortBy<T>(rows: readonly T[], order: SortOrder, pick: (row: T) => { created: string; name: string }): T[] {
  const out = [...rows];
  if (order === 'newest') return out.sort((a, b) => (pick(b).created ?? '').localeCompare(pick(a).created ?? ''));
  return out.sort((a, b) => pick(a).name.localeCompare(pick(b).name, 'en', { sensitivity: 'base' }));
}

/** Lowercase, accents and "đ" folded to plain letters, so "nguyen" finds "Nguyễn". */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase();
}

/** True when the query is empty or appears in any of the fields (case- and accent-insensitive). */
export function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = fold(query.trim());
  if (!q) return true;
  return fields.some((f) => f != null && fold(f).includes(q));
}

export type UsageLevel = 'ok' | 'warn' | 'high';

/** Storage level: below 70% ok, 70% to 85% warn, above 85% high. Integer maths, so the edges are exact. */
export function usageLevel(used: number, quota: number): UsageLevel {
  if (quota <= 0) return used > 0 ? 'high' : 'ok';
  if (used * 100 > quota * 85) return 'high';
  if (used * 100 >= quota * 70) return 'warn';
  return 'ok';
}

/** Bytes as whole megabytes. */
export function mb(bytes: number): number {
  return Math.round(bytes / MB);
}
