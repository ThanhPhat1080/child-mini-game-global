import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from '@/lib/media';
import { libraryOrder } from '@/lib/mediaPaths';
import { getMyUserId } from '@/lib/review';

const IMAGE_EXT = /\.(png|jpe?g|webp|svg)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav)$/i;
const PAGE = 100;

const USER_FOLDER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Every file of one kind in the media bucket, used or not (the pick-from-library pop-up and the Media page). Folders are walked down to a few levels;
 * bundled art is not in the bucket. Newest first by the upload id in the name. Throws when the bucket cannot be listed.
 * `own` (default): the user's own folder only (Q1, Q3). `all`: every owner's folder, for a Super Admin's Media page (their own and the parents' files).
 */
export async function listLibrary(kind: 'image' | 'audio', scope: 'own' | 'all' = 'own'): Promise<string[]> {
  const owner = await getMyUserId();
  if (!owner) return [];
  const store = createSupabaseBrowserClient().storage.from(MEDIA_BUCKET);
  const want = kind === 'image' ? IMAGE_EXT : AUDIO_EXT;
  const found: string[] = [];
  async function walk(dir: string, depth: number): Promise<void> {
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await store.list(dir, { limit: PAGE, offset });
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        const path = dir ? `${dir}/${item.name}` : item.name;
        if (item.id === null) { if (depth < 3) await walk(path, depth + 1); } // a folder
        else if (want.test(item.name)) found.push(path);
      }
      if ((data?.length ?? 0) < PAGE) return;
    }
  }
  if (scope === 'own') {
    await walk(owner, 0);
  } else {
    // The bucket's top level holds one folder per owner, named by the owner's user id.
    for (let offset = 0; ; offset += PAGE) {
      const { data, error } = await store.list('', { limit: PAGE, offset });
      if (error) throw new Error(error.message);
      for (const item of data ?? []) {
        if (item.id === null && USER_FOLDER.test(item.name)) await walk(item.name, 0);
      }
      if ((data?.length ?? 0) < PAGE) break;
    }
  }
  return libraryOrder(found);
}
