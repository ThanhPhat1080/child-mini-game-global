'use client';

import Link from 'next/link';
import { mediaUrl } from '@/lib/media';
import type { SpotLevel } from '@/lib/spot/types';
import { Pic } from '@/components/Pic';

/** One level on the level-select screen: picture A in a rounded pastel frame. The link is named by the caller; the picture is decorative. */
export function SpotLevelTile({ level, index }: { level: SpotLevel; index: number }) {
  const src = mediaUrl(level.image_a_path);
  return (
    <Link
      href={`/games/spot/${level.id}`}
      data-level-link
      draggable={false}
      className="hm-card"
      aria-label={`Play level ${index + 1}`}
      style={{ display: 'flex', width: 360, aspectRatio: '1 / 1', borderRadius: 40, background: '#fff', border: '8px solid #A9C6DE', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', overflow: 'hidden', fontFamily: 'inherit' }}
    >
      {src ? <Pic src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span aria-hidden="true" style={{ flex: 1, background: '#E3EEF7' }} />}
    </Link>
  );
}
