import { randomId } from '@/lib/randomId';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PENDING_PREFIX, isBucketPath, mapSetMedia, storedName, type SetPaths } from '@/lib/mediaPaths';
import { referencedPaths } from '@/lib/media/refs';
import { getMyUserId } from '@/lib/review';

export const MEDIA_BUCKET = 'media';
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
/** Sounds are limited like images (Q5); the bucket and the storage policy allow more, this is the UI limit. */
export const MAX_SOUND_BYTES = 2 * 1024 * 1024;

const SIZE_ERRORS: [string, number, string][] = [
  ['image/', MAX_IMAGE_BYTES, 'Image must be 2 MB or smaller.'],
  ['audio/', MAX_SOUND_BYTES, 'Sound must be 2 MB or smaller.'],
];

/** Throws the friendly size message when a file is over the limit for its kind. */
function checkSize(file: File): void {
  for (const [prefix, max, message] of SIZE_ERRORS) if (file.type.startsWith(prefix) && file.size > max) throw new Error(message);
}

/** The database refuses an upload that would pass the owner's quota (Q4); say so in plain words. */
const friendly = (message: string): string =>
  /quota_exceeded/i.test(message) ? 'Your storage is full. Delete files you no longer use, or ask the Super Admin for more space.' : message;

/** Files the admin picked but has not saved yet. They are previewed from memory and uploaded on Save. */
const pending = new Map<string, { file: File; url: string }>();

export const isPending = (path: string | null | undefined): boolean => !!path && path.startsWith(PENDING_PREFIX);

/** Keeps a picked file in memory and returns a placeholder path for it. Nothing is sent to the bucket. */
export function addPending(file: File): string {
  checkSize(file);
  const token = PENDING_PREFIX + randomId();
  pending.set(token, { file, url: URL.createObjectURL(file) });
  return token;
}

export const pendingName = (token: string): string => pending.get(token)?.file.name ?? 'New file';

/** Raw SVG code -> its single pending token, so identical drawings share one file and one upload. */
const svgTokens = new Map<string, string>();

export function svgToPending(svg: string): string {
  const known = svgTokens.get(svg);
  if (known && pending.has(known)) return known;
  const token = addPending(new File([svg], 'image.svg', { type: 'image/svg+xml' }));
  svgTokens.set(svg, token);
  return token;
}

/** Turns SVG code in imported questions into pending files (identical code reuses the same one). */
export function materializeSvg<T extends { qimg: string | null; imgs: (string | null)[] }>(qs: T[]): T[] {
  const conv = (p: string | null) => (p && p.startsWith('<') ? svgToPending(p) : p);
  return qs.map((q) => ({ ...q, qimg: conv(q.qimg), imgs: q.imgs.map(conv) }));
}

/** Forgets picked files (all, or all except `keep`) and frees their previews. */
export function clearPending(keep: string[] = []): void {
  for (const [token, p] of pending) {
    if (keep.includes(token)) continue;
    URL.revokeObjectURL(p.url);
    pending.delete(token);
  }
  for (const [svg, token] of svgTokens) if (!pending.has(token)) svgTokens.delete(svg);
}

/** Public URL for a path in the media bucket, or null when there is no file. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith(PENDING_PREFIX)) return pending.get(path)?.url ?? null; // local preview, not uploaded yet
  if (path.startsWith('seed/')) return `/${path}`; // bundled sample art
  if (/^https?:\/\//i.test(path)) return path; // image link from the internet (Quick import)
  const supabase = createSupabaseBrowserClient();
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Uploads a file into the signed-in user's own folder of the media bucket and returns its path `<userId>/<folder>/<name>` (Q1, Q3). */
export async function uploadMedia(folder: string, file: File): Promise<string> {
  checkSize(file);
  const owner = await getMyUserId();
  if (!owner) throw new Error('Please sign in again.');
  const supabase = createSupabaseBrowserClient();
  const dot = file.name.lastIndexOf('.');
  const ext = dot >= 0 ? file.name.slice(dot + 1).toLowerCase() : 'bin';
  const path = `${owner}/${folder}/${storedName(file.name, ext)}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(friendly(error.message));
  return path;
}

/**
 * Deletes files from the media bucket to free storage. Bundled art and external links are skipped.
 * A file that any record still uses is kept (A23). If that check fails, nothing is deleted.
 * Returns an error message, or null on success (keeping a file is not an error). Admin only (RLS, T1).
 */
export async function removeMedia(paths: (string | null | undefined)[]): Promise<string | null> {
  const mine = [...new Set(paths.filter(isBucketPath))];
  if (!mine.length) return null;
  let inUse: Set<string>;
  try {
    inUse = await referencedPaths(mine);
  } catch {
    return null; // cannot tell which files are still used: keep them all
  }
  const unused = mine.filter((p) => !inUse.has(p));
  if (!unused.length) return null;
  const { error } = await createSupabaseBrowserClient().storage.from(MEDIA_BUCKET).remove(unused);
  return error ? error.message : null;
}

/** True when some record uses this bucket file. Throws when that cannot be checked. */
export async function isMediaInUse(path: string): Promise<boolean> {
  return (await referencedPaths([path])).has(path);
}

/**
 * Deletes one file from the media bucket for good (library Delete). The caller checks isMediaInUse first;
 * this checks again, so a file a record picked up in the meantime is kept. Returns false when it was kept. Throws on failure. Admin only (RLS).
 */
export async function deleteMedia(path: string): Promise<boolean> {
  if (await isMediaInUse(path)) return false;
  const { error } = await createSupabaseBrowserClient().storage.from(MEDIA_BUCKET).remove([path]);
  if (error) throw new Error(error.message);
  return true;
}

/** Uploads a file picked in the library (pop-up or Media page) into the `library` folder now, so it can be chosen before Save. */
export const uploadToLibrary = (file: File): Promise<string> => uploadMedia('library', file);

/** Uploads one picked file now (called on Save) and returns its bucket path. */
export async function uploadPending(token: string, folder: string): Promise<string> {
  const p = pending.get(token);
  if (!p) throw new Error('A chosen file is no longer available. Please choose it again.');
  return uploadMedia(folder, p.file);
}

/**
 * Uploads the picked files in `wanted` (token -> folder) and returns token -> bucket path.
 * If any upload fails, the files uploaded so far are deleted and the error is rethrown.
 */
export async function commitPendingMap(wanted: Map<string, string>): Promise<Map<string, string>> {
  const done = new Map<string, string>();
  try {
    for (const [token, folder] of wanted) done.set(token, await uploadPending(token, folder));
  } catch (e) {
    await removeMedia([...done.values()]);
    throw e;
  }
  return done;
}

/**
 * Uploads every picked file in the set and swaps the placeholders for real paths.
 * If any upload fails, the files uploaded so far are deleted and the error is thrown, so nothing is left behind.
 */
export async function commitPendingMedia<T extends SetPaths>(d: T): Promise<{ d: T; uploaded: string[] }> {
  const wanted = new Map<string, string>();
  mapSetMedia(d, (p, folder) => { if (p && isPending(p)) wanted.set(p, folder); return p; });
  const done = await commitPendingMap(wanted);
  return { d: mapSetMedia(d, (p) => (p ? done.get(p) ?? p : p)), uploaded: [...done.values()] };
}
