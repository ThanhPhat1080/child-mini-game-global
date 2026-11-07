import { randomId } from '@/lib/randomId';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { copiedIds, getMyRole, getMyUserId, type Visibility } from '@/lib/review';
import { removeMedia } from '@/lib/media';
import { setMediaPaths } from '@/lib/mediaPaths';

export const PRESETS = {
  rose: { label: 'Rose', text: '#B8737B', tint: '#F8DCDF' },
  sky: { label: 'Sky', text: '#4F7A9E', tint: '#DCE8F1' },
  butter: { label: 'Butter', text: '#8A6A2A', tint: '#F7ECCB' },
  sage: { label: 'Sage', text: '#4F7A59', tint: '#E3EEDD' },
  plum: { label: 'Plum', text: '#7D5E91', tint: '#EADFF0' },
  cocoa: { label: 'Cocoa', text: '#5A4038', tint: '#F1E7DA' },
} as const;
export type PresetKey = keyof typeof PRESETS;

export function mixWhite(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * (1 - a) + 255 * a));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f((n >> 16) & 255) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
}
/** Cover circle tint for a heading color: preset tint or the color mixed with white. */
export function tintFor(hex: string): string {
  const p = Object.values(PRESETS).find((x) => x.text.toLowerCase() === hex.toLowerCase());
  return p ? p.tint : mixWhite(hex, 0.8);
}
export function presetKeyFor(hex: string): PresetKey | 'custom' {
  const k = (Object.keys(PRESETS) as PresetKey[]).find((x) => PRESETS[x].text.toLowerCase() === hex.toLowerCase());
  return k ?? 'custom';
}

export type EQuestion = {
  id: string;
  text: string;
  voice: string | null;
  qimg: string | null;
  imgs: (string | null)[]; // always length 3
  texts: string[]; // answer text read aloud, always length 3
  readAnswers: boolean; // read the answers aloud (sequence + on pick)
  hideAnswerText: boolean; // do not show the answer text on the child's cards (it is still read aloud)
  correct: number | null;
  count: 2 | 3;
};
export type ESet = {
  id: string;
  isNew: boolean;
  name: string;
  subtitle: string;
  color: string; // hex
  cover: string | null;
  published: boolean;
  qs: EQuestion[];
  /** Sharing state and owner (spec V1-V4); absent for a set not saved yet. */
  visibility?: Visibility;
  ownerId?: string | null;
  /** The signed-in user is a Super Admin and owns the set (V8): it stays editable. */
  superOwned?: boolean;
  /** A parent's set with a global copy of a Super Admin (V10): shows the "Global copy" badge. */
  copied?: boolean;
};

/** An answer needs a picture, a text, or both (C4). Both empty is invalid. */
export function hasAnswerContent(image: string | null | undefined, text: string | null | undefined): boolean {
  return !!image || !!text?.trim();
}

export function isQuestionComplete(q: { text: string; voice: string | null; imgs: (string | null)[]; texts: string[]; correct: number | null; count: number }): boolean {
  return (!!q.text.trim() || !!q.voice) && q.imgs.slice(0, q.count).every((img, i) => hasAnswerContent(img, q.texts[i])) && q.correct !== null && q.correct < q.count;
}

export function newQuestion(): EQuestion {
  return { id: randomId(), text: '', voice: null, qimg: null, imgs: [null, null, null], texts: ['', '', ''], readAnswers: true, hideAnswerText: false, correct: null, count: 3 };
}
export function blankSet(): ESet {
  return { id: randomId(), isNew: true, name: '', subtitle: '', color: PRESETS.rose.text, cover: null, published: false, qs: [] };
}

type Row = {
  id: string; title: string; subtitle: string | null; heading_color: string; cover_path: string | null; status: string; owner_id: string | null; visibility: Visibility;
  questions: { id: string; position: number; prompt_text: string | null; prompt_image_path: string | null; prompt_audio_path: string | null; read_answers: boolean; hide_answer_text: boolean; answers: { slot: number; image_path: string | null; text: string | null; is_correct: boolean }[] }[];
};

export async function loadSet(id: string): Promise<ESet | null> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('quiz_sets')
    .select('id, title, subtitle, heading_color, cover_path, status, owner_id, visibility, questions(id, position, prompt_text, prompt_image_path, prompt_audio_path, read_answers, hide_answer_text, answers(slot, image_path, text, is_correct))')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as unknown as Row;
  const qs = [...r.questions].sort((a, b) => a.position - b.position).map((q): EQuestion => {
    const imgs: (string | null)[] = [null, null, null];
    const texts = ['', '', ''];
    let correct: number | null = null;
    q.answers.forEach((a) => { imgs[a.slot - 1] = a.image_path; texts[a.slot - 1] = a.text ?? ''; if (a.is_correct) correct = a.slot - 1; });
    const slots = q.answers.length;
    return { id: q.id, text: q.prompt_text ?? '', voice: q.prompt_audio_path, qimg: q.prompt_image_path, imgs, texts, readAnswers: q.read_answers, hideAnswerText: !!q.hide_answer_text, correct, count: slots === 2 ? 2 : 3 };
  });
  const [me, role] = await Promise.all([getMyUserId(), getMyRole()]);
  const superOwned = role === 'super_admin' && r.owner_id === me;
  const copied = !superOwned && r.owner_id === me && r.owner_id !== null && (await copiedIds('quiz_sets', [r.id])).has(r.id);
  return { id: r.id, isNew: false, name: r.title, subtitle: r.subtitle ?? '', color: r.heading_color, cover: r.cover_path, published: r.status === 'published', qs, visibility: r.visibility, ownerId: r.owner_id, superOwned, copied };
}

/** Saves the whole set. Returns an error message, or null on success. */
export async function saveSet(d: ESet, wasPublished: boolean): Promise<string | null> {
  const sb = createSupabaseBrowserClient();
  const fail = (m: string | undefined) => m ?? null;
  const now = new Date().toISOString();

  if (d.isNew) {
    const { data: last } = await sb.from('quiz_sets').select('position').order('position', { ascending: false }).limit(1);
    const position = ((last?.[0]?.position as number | undefined) ?? -1) + 1;
    const { error } = await sb.from('quiz_sets').insert({ id: d.id, title: d.name.trim(), subtitle: d.subtitle.trim() || null, heading_color: d.color, cover_path: d.cover, status: 'draft', position, updated_at: now });
    if (error) return error.message;
  } else {
    const patch: Record<string, unknown> = { title: d.name.trim(), subtitle: d.subtitle.trim() || null, heading_color: d.color, cover_path: d.cover, updated_at: now };
    if (!d.published) patch.status = 'draft';
    const { error } = await sb.from('quiz_sets').update(patch).eq('id', d.id);
    if (error) return error.message;
  }

  // remove deleted questions
  const { data: existing, error: e1 } = await sb.from('questions').select('id').eq('set_id', d.id);
  if (e1) return e1.message;
  const keep = new Set(d.qs.map((q) => q.id));
  const gone = (existing ?? []).map((x) => x.id as string).filter((x) => !keep.has(x));
  if (gone.length) {
    const { error } = await sb.from('questions').delete().in('id', gone);
    if (error) return error.message;
  }

  if (d.qs.length) {
    // one request = one transaction, so the deferred (set_id, position) key is safe
    const { error: e2 } = await sb.from('questions').upsert(
      d.qs.map((q, i) => ({ id: q.id, set_id: d.id, position: i, prompt_text: q.text.trim() || null, prompt_image_path: q.qimg, prompt_audio_path: q.voice, read_answers: q.readAnswers, hide_answer_text: q.hideAnswerText })),
      { onConflict: 'id' },
    );
    if (e2) return e2.message;

    const ids = d.qs.map((q) => q.id);
    const { error: e3 } = await sb.from('answers').update({ is_correct: false }).in('question_id', ids);
    if (e3) return e3.message;
    const rows = d.qs.flatMap((q) => Array.from({ length: q.count }, (_, i) => ({ question_id: q.id, slot: i + 1, image_path: q.imgs[i], text: q.texts[i].trim() || null, is_correct: q.correct === i })));
    const { error: e4 } = await sb.from('answers').upsert(rows, { onConflict: 'question_id,slot' });
    if (e4) return e4.message;
    for (const q of d.qs.filter((x) => x.count === 2)) {
      const { error } = await sb.from('answers').delete().eq('question_id', q.id).gt('slot', 2);
      if (error) return error.message;
    }
  }

  if (d.published && !wasPublished) {
    const { error } = await sb.from('quiz_sets').update({ status: 'published' }).eq('id', d.id);
    if (error) return fail(error.message.includes('complete question') ? 'Add at least one complete question before publishing. Your changes were saved as a draft.' : error.message);
  }
  return null;
}

/** Deletes a set, then frees its files in the bucket. `warning` is set when only the file cleanup failed. */
export async function deleteSet(id: string): Promise<{ error: string | null; warning: string | null }> {
  let paths: string[] = [];
  try {
    const set = await loadSet(id);
    if (set) paths = setMediaPaths(set);
  } catch { /* delete anyway; files are then left behind */ }
  const { error } = await createSupabaseBrowserClient().from('quiz_sets').delete().eq('id', id);
  if (error) return { error: error.message, warning: null };
  const failed = await removeMedia(paths);
  return { error: null, warning: failed ? 'The set was deleted, but some of its files could not be removed from storage.' : null };
}
