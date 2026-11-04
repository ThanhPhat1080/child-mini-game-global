import { randomId } from '@/lib/randomId';

/** A picked file that is only previewed locally; it is uploaded when the user presses Save. */
export const PENDING_PREFIX = 'pending:';

/** Upload id: the time in base 36 (so it sorts by upload time) plus 4 random characters. Always 13 characters. */
const uploadId = (): string => Date.now().toString(36).padStart(9, '0') + randomId().replace(/-/g, '').slice(0, 4);

/** The original file name without its extension, as ASCII safe for a storage key ("Âm thanh 1.mp3" -> "Am-thanh-1"). */
export function safeStem(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/, '');
  const ascii = stem.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  return ascii.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '') || 'file';
}

/** Storage file name: the safe original name, then the upload id, then the extension (`oh-ring-9j2k4m1a7b3cx.mp3`). */
export const storedName = (fileName: string, ext: string): string => `${safeStem(fileName)}-${uploadId()}.${ext}`;

const idOf = (path: string): string => /-([0-9a-z]{13})\.[^./]+$/.exec(path)?.[1] ?? '';

/** Newest upload first (by the id in the name). Files uploaded before this naming go last, by name. */
export function libraryOrder(paths: Iterable<string>): string[] {
  return [...new Set(paths)].sort((a, b) => (idOf(a) === idOf(b) ? a.localeCompare(b) : idOf(a) < idOf(b) ? 1 : -1));
}

/** The part of a file name a person can rename: the name without its upload id and extension (`library/oh-ring-9j2k4m1a7b3cx.mp3` -> `oh-ring`). */
export function editableStem(path: string): string {
  const base = path.split('/').pop() ?? path;
  const noExt = base.replace(/\.[^.]*$/, '');
  const id = idOf(path);
  return id && noExt.endsWith(`-${id}`) ? noExt.slice(0, -(id.length + 1)) : noExt;
}

/** The path after renaming: same folder, upload id and extension, with the new name made safe (`oh-ring` -> `Bell`: `library/Bell-9j2k4m1a7b3cx.mp3`). */
export function renamedPath(path: string, newName: string): string {
  const slash = path.lastIndexOf('/');
  const dir = slash >= 0 ? path.slice(0, slash + 1) : '';
  const base = path.slice(slash + 1);
  const dot = base.lastIndexOf('.');
  const ext = dot >= 0 ? base.slice(dot) : '';
  const id = idOf(path);
  const stem = safeStem(`${newName}.x`);
  return `${dir}${stem}${id ? `-${id}` : ''}${ext}`;
}

/** A copy of `value` with every string equal to `from` replaced by `to`. Unchanged parts keep their identity, so React sees no change when `from` is absent. */
export function replacePath<T>(value: T, from: string, to: string): T {
  if (value === from) return to as unknown as T;
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((v) => { const r = replacePath(v, from, to); if (r !== v) changed = true; return r; });
    return (changed ? next : value) as unknown as T;
  }
  if (value && typeof value === 'object') {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) { const r = replacePath(v, from, to); if (r !== v) changed = true; next[k] = r; }
    return (changed ? next : value) as T;
  }
  return value;
}

/** True for a file that lives in our `media` bucket. Bundled art, external links and unsaved picks are not ours to delete. */
export function isBucketPath(path: string | null | undefined): path is string {
  return !!path && !path.startsWith('seed/') && !path.startsWith(PENDING_PREFIX) && !/^https?:\/\//i.test(path);
}

export type SetPaths = {
  cover: string | null;
  qs: { qimg: string | null; voice: string | null; imgs: (string | null)[] }[];
};

/** Returns a copy of the set with every media field passed through `fn(path, folder)`. */
export function mapSetMedia<T extends SetPaths>(d: T, fn: (path: string | null, folder: string) => string | null): T {
  return {
    ...d,
    cover: fn(d.cover, 'covers'),
    qs: d.qs.map((q) => ({ ...q, qimg: fn(q.qimg, 'questions'), voice: fn(q.voice, 'voices'), imgs: q.imgs.map((p) => fn(p, 'answers')) })),
  };
}

/** Every bucket file a set points to (cover, question images and voices, answer images). */
export function setMediaPaths(d: SetPaths): string[] {
  const all = [d.cover, ...d.qs.flatMap((q) => [q.qimg, q.voice, ...q.imgs])];
  return all.filter(isBucketPath);
}

/**
 * Files to delete once a save has been committed: everything the previous saved state or this
 * edit session's uploads pointed to that the committed state no longer uses.
 */
export function pathsToDelete(
  before: Iterable<string | null | undefined>,
  after: Iterable<string | null | undefined>,
  uploaded: Iterable<string | null | undefined> = [],
): string[] {
  const keep = new Set(after);
  const out = new Set<string>();
  for (const p of [...before, ...uploaded]) if (isBucketPath(p) && !keep.has(p)) out.add(p);
  return [...out];
}
