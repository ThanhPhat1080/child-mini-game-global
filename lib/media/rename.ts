import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from '@/lib/media';
import { renamedPath, replacePath } from '@/lib/mediaPaths';
import { MEDIA_SOURCES, objectAudioPaths } from '@/lib/media/refs';
import { announceRename } from '@/lib/media/renames';

/** Points every record that uses `from` at `to`. Each change adds its reverse to `undo`, so a failure part-way can be put back. */
async function repoint(from: string, to: string, undo: (() => Promise<void>)[]): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const fail = (m: string) => { throw new Error(m); };
  for (const src of MEDIA_SOURCES) {
    if (src.objectAudio) {
      const { data, error } = await supabase.from(src.table).select('id, objects');
      if (error) fail(error.message);
      for (const row of (data ?? []) as unknown as { id: string; objects: unknown }[]) {
        if (!objectAudioPaths(row.objects).includes(from)) continue;
        const r = await supabase.from(src.table).update({ objects: replacePath(row.objects, from, to) }).eq('id', row.id);
        if (r.error) fail(r.error.message);
        undo.push(async () => { await supabase.from(src.table).update({ objects: row.objects }).eq('id', row.id); });
      }
      continue;
    }
    const r = await supabase.from(src.table).update({ [src.column]: to }).eq(src.column, from).select(src.column);
    if (r.error) fail(r.error.message);
    if (r.data?.length) undo.push(async () => { await supabase.from(src.table).update({ [src.column]: from }).eq(src.column, to); });
  }
}

/**
 * Renames a library file: moves it in the bucket, then points every record at the new path. If a record cannot be
 * updated, everything is put back. Open pages are told so their unsaved edits follow the file. Returns the new path.
 * Throws a readable message on failure. Admin only (RLS).
 */
export async function renameMedia(path: string, newName: string): Promise<string> {
  const to = renamedPath(path, newName);
  if (to === path) return path;
  const storage = createSupabaseBrowserClient().storage.from(MEDIA_BUCKET);
  const { error } = await storage.move(path, to);
  if (error) throw new Error(/exist|duplicate/i.test(error.message) ? 'A file with that name already exists.' : error.message);
  const undo: (() => Promise<void>)[] = [];
  try {
    await repoint(path, to, undo);
  } catch (e) {
    for (const u of undo.reverse()) await u();
    await storage.move(to, path);
    throw e;
  }
  announceRename(path, to);
  return to;
}
