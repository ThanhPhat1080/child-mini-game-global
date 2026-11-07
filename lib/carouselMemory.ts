/**
 * The position of a carousel (which level is centered), kept for the browser tab so that leaving a level and coming
 * back lands on the same one. A convenience only: storage may be blocked, then the carousel starts at the first item.
 */
export function rememberIndex(key: string, index: number): void {
  try { sessionStorage.setItem(key, String(index)); } catch { /* storage blocked */ }
}

/** The remembered position, clamped to the `count` items there are now; 0 when nothing (or nothing valid) is stored. */
export function recallIndex(key: string, count: number): number {
  try {
    const v = Number(sessionStorage.getItem(key));
    if (Number.isInteger(v) && v >= 0 && v < count) return v;
  } catch { /* storage blocked */ }
  return 0;
}
