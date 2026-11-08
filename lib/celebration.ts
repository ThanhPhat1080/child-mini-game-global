'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getActiveChildId } from '@/lib/childSession';
import { mediaUrl } from '@/lib/media';
import { GENDER_THEME, type Gender } from '@/lib/childTheme';

/**
 * The frame a celebration picture is shown in (CelebrationScene): 340 px wide, 600 px tall, a portrait frame.
 * The admin crops an uploaded picture to this shape (A32), so nothing is cut or left empty on the screen.
 */
export const CELEBRATION_FRAME = { width: 340, height: 600 } as const;
/** Width divided by height of the celebration frame (about 3:5). */
export const CELEBRATION_ASPECT = CELEBRATION_FRAME.width / CELEBRATION_FRAME.height;

/**
 * The child's celebration pictures a (left) and b (right), as public URLs (null when not uploaded), and the
 * child's gender, which picks the built-in character: prince for a boy, princess for a girl.
 */
export type CelebrationPictures = { a: string | null; b: string | null; gender: Gender };
const NONE: CelebrationPictures = { a: null, b: null, gender: 'female' };

/**
 * The pictures of the "You did it" scene (parent feedback):
 * - both A and B uploaded: A on the left, B on the right, and no built-in character;
 * - only A or only B uploaded: the built-in character on the left, the uploaded picture on the right;
 * - nothing uploaded: the built-in character alone on the left.
 */
export type CelebrationSlot = { src: string; kind: 'default' | 'a' | 'b' };
export function celebrationSlots(pics: CelebrationPictures): { left: CelebrationSlot; right: CelebrationSlot | null } {
  const builtIn: CelebrationSlot = { src: GENDER_THEME[pics.gender].hero, kind: 'default' };
  if (pics.a && pics.b) return { left: { src: pics.a, kind: 'a' }, right: { src: pics.b, kind: 'b' } };
  if (pics.a) return { left: builtIn, right: { src: pics.a, kind: 'a' } };
  if (pics.b) return { left: builtIn, right: { src: pics.b, kind: 'b' } };
  return { left: builtIn, right: null };
}

/**
 * The child's celebration pictures and gender on this device.
 * Never throws: no child chosen, no row or a failed request all mean "nothing uploaded, a girl's character".
 */
export async function fetchCelebrationPictures(): Promise<CelebrationPictures> {
  try {
    const id = getActiveChildId();
    if (!id) return NONE;
    const { data, error } = await createSupabaseBrowserClient()
      .from('children')
      .select('celebrate_a_path, celebrate_b_path, gender')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return NONE;
    const row = data as { celebrate_a_path: string | null; celebrate_b_path: string | null; gender: Gender | null };
    return { a: mediaUrl(row.celebrate_a_path), b: mediaUrl(row.celebrate_b_path), gender: row.gender === 'male' ? 'male' : 'female' };
  } catch {
    return NONE;
  }
}

/** The pictures once they are known; null while they load, so no character flashes in before the child's own is known. */
export function useCelebrationPictures(): CelebrationPictures | null {
  const [pics, setPics] = useState<CelebrationPictures | null>(null);
  useEffect(() => {
    let live = true;
    void fetchCelebrationPictures().then((p) => { if (live) setPics(p); });
    return () => { live = false; };
  }, []);
  return pics;
}
