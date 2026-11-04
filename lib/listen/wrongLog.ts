/** Wrong picks of one Listen & Pick play (L7), kept in localStorage; never throws. */
export const WRONG_KEY = 'hamy.listen.wrong';

export type WrongEntry = { id: string; word: string; count: number };

/** Source of truth once something was recorded in this page visit; storage is then only a best-effort mirror. */
let memory: WrongEntry[] = [];
let recorded = false;

function parse(raw: string | null): WrongEntry[] | null {
  if (raw === null) return null;
  try {
    const list: unknown = JSON.parse(raw);
    if (!Array.isArray(list)) return null;
    const ok = list.every((e) => {
      if (typeof e !== 'object' || e === null) return false;
      const x = e as Record<string, unknown>;
      return typeof x.id === 'string' && typeof x.word === 'string'
        && typeof x.count === 'number' && Number.isInteger(x.count) && x.count > 0;
    });
    if (!ok) return null;
    if (new Set((list as WrongEntry[]).map((e) => e.id)).size !== list.length) return null;
    return (list as WrongEntry[]).map((e) => ({ id: e.id, word: e.word, count: e.count }));
  } catch {
    return null;
  }
}

function stored(): WrongEntry[] | null {
  try { return parse(window.localStorage.getItem(WRONG_KEY)); } catch { return null; }
}

export function readWrong(): WrongEntry[] {
  return (recorded ? memory : stored() ?? []).map((e) => ({ ...e }));
}

export function recordWrong(card: { id: string; word: string }): void {
  const next = readWrong();
  const hit = next.find((e) => e.id === card.id);
  if (hit) hit.count += 1;
  else next.push({ id: card.id, word: card.word, count: 1 });
  memory = next;
  recorded = true;
  try { window.localStorage.setItem(WRONG_KEY, JSON.stringify(next)); } catch { /* blocked or full: memory copy only */ }
}

export function clearWrong(): void {
  memory = [];
  recorded = false;
  try { window.localStorage.removeItem(WRONG_KEY); } catch { /* ignore */ }
}

export function totalWrong(entries: readonly WrongEntry[]): number {
  return entries.reduce((sum, e) => sum + e.count, 0);
}
