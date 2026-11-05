import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Every column that can point at a file in the `media` bucket. `kind` says what the file is.
 * find_levels.objects is a jsonb list, so its audio lives inside it: `objectAudio` marks that entry.
 */
export type MediaSource =
  | { table: string; column: string; kind: 'image' | 'audio'; objectAudio?: false }
  | { table: 'find_levels'; column: 'objects'; kind: 'audio'; objectAudio: true };

export const MEDIA_SOURCES: MediaSource[] = [
  { table: 'child_settings', column: 'greeting_path', kind: 'audio' },
  { table: 'child_settings', column: 'music_path', kind: 'audio' },
  { table: 'children', column: 'avatar_path', kind: 'image' },
  { table: 'child_settings', column: 'hooray_path', kind: 'audio' },
  { table: 'child_settings', column: 'ohoh_path', kind: 'audio' },
  { table: 'child_settings', column: 'complete_path', kind: 'audio' },
  { table: 'quiz_sets', column: 'cover_path', kind: 'image' },
  { table: 'questions', column: 'prompt_image_path', kind: 'image' },
  { table: 'questions', column: 'prompt_audio_path', kind: 'audio' },
  { table: 'answers', column: 'image_path', kind: 'image' },
  { table: 'memory_cards', column: 'image_path', kind: 'image' },
  { table: 'memory_cards', column: 'audio_path', kind: 'audio' },
  { table: 'spot_levels', column: 'image_a_path', kind: 'image' },
  { table: 'spot_levels', column: 'image_b_path', kind: 'image' },
  { table: 'find_levels', column: 'image_path', kind: 'image' },
  { table: 'find_levels', column: 'objects', kind: 'audio', objectAudio: true },
];

/** The sound paths inside one find_levels.objects value (each object's audio_path). */
export function objectAudioPaths(objects: unknown): string[] {
  if (!Array.isArray(objects)) return [];
  return objects.flatMap((o) => {
    const p = (o as { audio_path?: unknown } | null)?.audio_path;
    return typeof p === 'string' && p ? [p] : [];
  });
}

/**
 * The subset of `paths` that some record still uses. Throws on any query error, so a caller
 * that deletes files can keep them when it cannot tell.
 */
export async function referencedPaths(paths: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!paths.length) return found;
  const supabase = createSupabaseBrowserClient();
  // The database function sees every owner's content and ignores RLS (Q6); a client query only sees its own rows.
  const results = await Promise.all([...new Set(paths)].map(async (p) => {
    const { data, error } = await supabase.rpc('media_in_use', { p_path: p });
    if (error) throw new Error(error.message);
    return [p, data === true] as const;
  }));
  for (const [p, used] of results) if (used) found.add(p);
  return found;
}

/**
 * The older, client-side scan of every MEDIA_SOURCES column. It only sees rows the caller can read, so it is not
 * used to decide deletes any more; it stays for the tests of which columns can point at a file.
 */
export async function referencedPathsByScan(paths: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (!paths.length) return found;
  const wanted = new Set(paths);
  const supabase = createSupabaseBrowserClient();

  for (const src of MEDIA_SOURCES) {
    if (src.objectAudio) {
      const { data, error } = await supabase.from(src.table).select(src.column);
      if (error) throw new Error(error.message);
      for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
        for (const p of objectAudioPaths(row[src.column])) if (wanted.has(p)) found.add(p);
      }
      continue;
    }
    const { data, error } = await supabase.from(src.table).select(src.column).in(src.column, paths);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as unknown as Record<string, unknown>[]) {
      const p = row[src.column];
      if (typeof p === 'string' && wanted.has(p)) found.add(p);
    }
  }
  return found;
}
