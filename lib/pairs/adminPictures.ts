import { randomId } from '@/lib/randomId';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/** One picture of the Puzzle Pairs list (A32). `isNew` rows exist only in the draft until Save. */
export type EPicture = { id: string; isNew: boolean; image: string | null; word: string; audio: string | null; active: boolean };

const WORD_MAX = 40;
const wordKey = (w: string) => w.trim().toLowerCase();

/** A picture is complete with a picture and a trimmed word of 1-40 characters. */
export function isPictureComplete(p: EPicture): boolean {
  const n = p.word.trim().length;
  return !!p.image && n >= 1 && n <= WORD_MAX;
}

/** Lower-cased trimmed words that appear on more than one picture (blank words ignored). */
export function duplicateWords(rows: readonly EPicture[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const p of rows) {
    const w = wordKey(p.word);
    if (!w) continue;
    if (seen.has(w)) dup.add(w);
    seen.add(w);
  }
  return dup;
}

/** The game needs 4 of these: active complete pictures, counted by distinct word (A33). */
export function readyCount(rows: readonly EPicture[]): number {
  const words = new Set<string>();
  for (const p of rows) if (p.active && isPictureComplete(p)) words.add(wordKey(p.word));
  return words.size;
}

type Row = { id: string; word: string; image_path: string; audio_path: string | null; active: boolean };

/** Every picture, the inactive ones too (the Super Admin sees them), in the order the game uses. Throws Error(message). */
export async function loadPictures(): Promise<EPicture[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('puzzle_pictures')
    .select('id, word, image_path, audio_path, active')
    .order('sort_order')
    .order('created_at');
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id, isNew: false, image: r.image_path, word: r.word, audio: r.audio_path ?? null, active: r.active }));
}

/**
 * Writes the draft against the saved list: deletes removed rows, inserts new ones, updates changed ones.
 * `sort_order` is the row's position in the draft. Stops at the first Supabase error and returns its message.
 */
export async function savePictures(saved: EPicture[], draft: EPicture[]): Promise<{ error: string | null }> {
  const sb = createSupabaseBrowserClient();
  const keep = new Set(draft.map((p) => p.id));
  const gone = saved.map((p) => p.id).filter((id) => !keep.has(id));
  const savedAt = new Map(saved.map((p, i) => [p.id, { p, i }]));
  try {
    if (gone.length) {
      const { error } = await sb.from('puzzle_pictures').delete().in('id', gone);
      if (error) return { error: error.message };
    }
    const fresh = draft.flatMap((p, i) => (p.isNew ? [{ id: p.id, word: p.word.trim(), image_path: p.image, audio_path: p.audio, active: p.active, sort_order: i }] : []));
    if (fresh.length) {
      const { error } = await sb.from('puzzle_pictures').insert(fresh);
      if (error) return { error: error.message };
    }
    for (const [i, p] of draft.entries()) {
      const before = savedAt.get(p.id);
      if (p.isNew || !before) continue;
      const same = before.p.word.trim() === p.word.trim() && before.p.image === p.image && before.p.audio === p.audio && before.p.active === p.active && before.i === i;
      if (same) continue;
      const { error } = await sb.from('puzzle_pictures').update({ word: p.word.trim(), image_path: p.image, audio_path: p.audio, active: p.active, sort_order: i }).eq('id', p.id);
      if (error) return { error: error.message };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** A new picture chosen from the library: empty word, on, no sound. */
export const newPicture = (image: string): EPicture => ({ id: randomId(), isNew: true, image, word: '', audio: null, active: true });
