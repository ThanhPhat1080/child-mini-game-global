import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { mediaUrl } from '@/lib/media';
import { speakKid } from '@/lib/sfx';
import type { MemoryCard } from '@/lib/memory/types';

/** Active cards only (the deck is built from these). Throws Error(message) when Supabase fails. */
export async function fetchActiveCards(): Promise<MemoryCard[]> {
  const { data, error } = await createSupabaseBrowserClient()
    .from('memory_cards')
    .select('id, word, image_path, audio_path, active')
    .eq('active', true)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []) as MemoryCard[];
}

/** The recording that is playing now, so a new word can cut it off (no overlapping voices). */
let current: HTMLAudioElement | null = null;

/**
 * Says a card's word: the recorded file when there is one, else (or if the file cannot play) the
 * English kid voice, never both and never twice. Never throws.
 * `onEnd` (optional) is called exactly once when the word has finished: the voice's end, the
 * recording's `ended`, or right away when nothing can be played. A word cut off by a newer word or
 * by `stopWord` may never call it, so callers waiting on it keep their own cap.
 */
export function sayWord(card: Pick<MemoryCard, 'word' | 'audio_path'>, onEnd?: () => void): void {
  let finished = false;
  const end = () => {
    if (finished) return;
    finished = true;
    try { onEnd?.(); } catch { /* the caller's problem, never ours */ }
  };
  const speak = () => (onEnd ? speakKid(card.word, { onEnd: end }) : speakKid(card.word));
  try {
    if (current) {
      current.pause();
      current = null;
    }
    const url = mediaUrl(card.audio_path);
    if (!url) {
      speak();
      return;
    }
    try { window.speechSynthesis?.cancel(); } catch { /* no speech engine: nothing to cut off */ }
    const audio = new Audio(url);
    current = audio;
    let fellBack = false;
    const fallback = () => {
      if (fellBack || current !== audio) return; // already spoken, or a newer word took over
      fellBack = true;
      current = null;
      speak();
    };
    audio.addEventListener('ended', () => {
      if (current === audio) current = null;
      if (!fellBack) end();
    });
    audio.addEventListener('error', fallback);
    audio.play().catch(fallback);
  } catch {
    try { speak(); } catch { end(); }
  }
}

/** Silences the word now (M10: leaving the page): pauses the recording and cancels speech. Never throws. */
export function stopWord(): void {
  const audio = current;
  current = null;
  try { audio?.pause(); } catch { /* nothing more to do */ }
  try {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  } catch { /* nothing more to do */ }
}
