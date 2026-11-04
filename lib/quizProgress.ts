/**
 * Where to go after a question is finished: the next question (cycling past the end) that the child has
 * not answered correctly yet, or null when every question is done and the set is complete.
 */
export function nextUnfinished(ids: readonly string[], current: number, done: ReadonlySet<string>): number | null {
  const n = ids.length;
  for (let step = 1; step <= n; step++) {
    const i = (current + step) % n;
    if (!done.has(ids[i])) return i;
  }
  return null;
}

/** Minimal slice of `localStorage`, so the helpers can be tested without a browser. */
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const key = (setId: string) => `hamy:progress:${setId}`;

/** The device's storage, or a do-nothing stand-in when the browser blocks it (reading the property can throw). */
export function deviceStore(): Store {
  try { return window.localStorage; } catch { return { getItem: () => null, setItem: () => undefined, removeItem: () => undefined }; }
}

/** Question ids finished on this device for a set. Ids that are no longer in the set are dropped. */
export function loadProgress(store: Store, setId: string, validIds: readonly string[]): Set<string> {
  try {
    const raw = store.getItem(key(setId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    const valid = new Set(validIds);
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && valid.has(x)) : []);
  } catch {
    return new Set(); // blocked storage or broken data: start fresh
  }
}

export function saveProgress(store: Store, setId: string, done: ReadonlySet<string>): void {
  try {
    if (done.size) store.setItem(key(setId), JSON.stringify([...done]));
    else store.removeItem(key(setId));
  } catch { /* storage blocked or full: progress just is not kept */ }
}

/** Forgets the dots of a set, e.g. once it is completed, so playing it again starts fresh. */
export function clearProgress(store: Store, setId: string): void {
  try { store.removeItem(key(setId)); } catch { /* ignore */ }
}

/** Where to resume: the first question not finished yet (0 when none is, i.e. start over). */
export function firstUnfinished(ids: readonly string[], done: ReadonlySet<string>): number {
  const i = ids.findIndex((id) => !done.has(id));
  return i < 0 ? 0 : i;
}
