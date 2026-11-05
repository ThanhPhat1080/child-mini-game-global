'use client';

import { useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getActiveChildId } from '@/lib/childSession';
import { mediaUrl } from '@/lib/media';

export type CelebrationPictures = { a: string | null; b: string | null };
const NONE: CelebrationPictures = { a: null, b: null };

/**
 * The two pictures the parent uploaded for the child on this device, as public URLs.
 * Never throws: no child chosen, no row or a failed request all mean "use the built-in characters".
 */
export async function fetchCelebrationPictures(): Promise<CelebrationPictures> {
  try {
    const id = getActiveChildId();
    if (!id) return NONE;
    const { data, error } = await createSupabaseBrowserClient()
      .from('children')
      .select('celebrate_a_path, celebrate_b_path')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return NONE;
    const row = data as { celebrate_a_path: string | null; celebrate_b_path: string | null };
    return { a: mediaUrl(row.celebrate_a_path), b: mediaUrl(row.celebrate_b_path) };
  } catch {
    return NONE;
  }
}

export function useCelebrationPictures(): CelebrationPictures {
  const [pics, setPics] = useState<CelebrationPictures>(NONE);
  useEffect(() => {
    let live = true;
    void fetchCelebrationPictures().then((p) => { if (live) setPics(p); });
    return () => { live = false; };
  }, []);
  return pics;
}
