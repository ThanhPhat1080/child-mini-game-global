import type { AgeBand, Gender } from './childTheme';

/**
 * Guest Play visitor (spec GU6): a child who plays with no account. Name, gender and age band live only in this
 * browser (localStorage) with a plain marker cookie that lets the middleware open the play pages. Leaving erases both.
 * The cookie only opens pages; data access is decided by RLS (GU11).
 */
export const VISITOR_COOKIE = 'cp_visitor';
const STORAGE_KEY = 'cp_visitor';
const YEAR = 60 * 60 * 24 * 365;

export type Visitor = { name: string; gender: Gender; ageBand: AgeBand };

/** The head picture shown for each gender (GU14). */
export const VISITOR_HEAD: Record<Gender, string> = {
  male: '/images/prince-head.webp',
  female: '/images/princess-head.webp',
};

const AGE_BANDS: readonly AgeBand[] = ['2-5', '5-10'];

/** Pure check of the form values: name 1-20 code points after trim, gender male or female, age band 2-5 or 5-10. */
export function validateVisitor(input: { name: string; gender: Gender | null; ageBand: AgeBand }):
  | { ok: true; value: Visitor }
  | { ok: false; errors: { name?: string; gender?: string } } {
  const name = input.name.trim();
  const errors: { name?: string; gender?: string } = {};
  // code points, so an emoji counts once
  if (name.length === 0 || [...name].length > 20) errors.name = 'Name must be 1-20 characters';
  if (input.gender !== 'male' && input.gender !== 'female') errors.gender = 'Pick Boy or Girl';
  if (errors.name || errors.gender || input.gender === null) return { ok: false, errors };
  const ageBand = AGE_BANDS.includes(input.ageBand) ? input.ageBand : '2-5';
  return { ok: true, value: { name, gender: input.gender, ageBand } };
}

/** Writes the visitor to localStorage and sets the marker cookie. A blocked storage is ignored. */
export function saveVisitor(v: Visitor): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    // storage blocked: getVisitor() then reads null, so the page treats the browser as no visitor
  }
  document.cookie = `${VISITOR_COOKIE}=1; Path=/; Max-Age=${YEAR}; SameSite=Lax`;
}

/** The saved visitor, or null for no data, bad JSON, invalid values or blocked storage. */
export function getVisitor(): Visitor | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as Partial<Visitor> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    const checked = validateVisitor({
      name: typeof parsed.name === 'string' ? parsed.name : '',
      gender: (parsed.gender ?? null) as Gender | null,
      ageBand: parsed.ageBand as AgeBand,
    });
    return checked.ok ? checked.value : null;
  } catch {
    return null;
  }
}

/** True when the marker cookie is set and the saved data is valid. A bare cookie is not a visitor. */
export function isVisitor(): boolean {
  return readMarker() && getVisitor() !== null;
}

/** Erases the visitor: the saved data and the marker cookie. */
export function clearVisitor(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing stored, or storage blocked
  }
  document.cookie = `${VISITOR_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function readMarker(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some((part) => part.trim() === `${VISITOR_COOKIE}=1`);
}
