'use client';

import { useEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/lib/media';
import type { MemoryCard } from '@/lib/memory/types';
import { Pic } from '@/components/Pic';

/** A card's picture, or a plain placeholder block when it is missing or broken. Never shows the word. */
export function SortPicture({ card }: { card: MemoryCard }) {
  const [broken, setBroken] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // the error event can fire before hydration attaches onError, so also check on mount
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  const src = mediaUrl(card.image_path);
  if (!src || broken) {
    return <span data-placeholder aria-hidden="true" style={{ display: 'block', width: '70%', height: '70%', borderRadius: 28, background: '#EFE6DA' }} />;
  }
  return <Pic ref={ref} src={src} alt="" draggable={false} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />;
}
