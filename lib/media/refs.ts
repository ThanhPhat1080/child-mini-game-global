import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Every column that can point at a file in the `media` bucket. `kind` says what the file is.
 * find_levels.objects is a jsonb list, so its audio lives inside it: `objectAudio` marks that entry.
 */
export type MediaSource =
  | { table: string; column: string; kind: 'image' | 'audio'; objectAudio?: false }
  | { table: 'find_levels'; column: 'objects'; kind: 'audio'; objectAudio: true };

export const MEDIA_SOURCES: MediaSource[] = [
  { table: 'settings', column: 'greeting_path', kind: 'audio' },
  { table: 'settings', column: 'music_path', kind: 'audio' },
  { table: 'settings', column: 'avatar_path', kind: 'image' },
  { table: 'settings', column: 'hooray_path', kind: 'audio' },
  { table: 'settings', column: 'ohoh_path', kind: 'audio' },
  { table: 'settings', column: 'complete_path', kind: 'audio' },
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
