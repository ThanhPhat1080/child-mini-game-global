import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { MEDIA_BUCKET } from '@/lib/media';
import { libraryOrder } from '@/lib/mediaPaths';
import { getMyUserId } from '@/lib/review';

const IMAGE_EXT = /\.(png|jpe?g|webp|svg)$/i;
const AUDIO_EXT = /\.(mp3|m4a|wav)$/i;
const PAGE = 100;

/**
 * Every file of one kind in the user's own folder of the media bucket, used or not (the pick-from-library pop-up and the Media page). Folders are walked down to a few levels;
 * bundled art is not in the bucket. Newest first by the upload id in the name. Throws when the bucket cannot be listed.
 */
export async function listLibrary(kind: 'image' | 'audio'): Promise<string[]> {
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
  await walk(owner, 0); // only the user's own folder (Q1, Q3)
  return libraryOrder(found);
}
