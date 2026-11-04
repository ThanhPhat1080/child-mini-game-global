'use client';

import Link from 'next/link';
import { mediaUrl } from '@/lib/media';
import type { FindLevel } from '@/lib/find/types';
import { Pic } from '@/components/Pic';

/** One level on the level-select screen: the big picture in a rounded peach frame. The link is named by the caller; the picture is decorative. */
export function FindLevelTile({ level, index }: { level: FindLevel; index: number }) {
  const src = mediaUrl(level.image_path);
  return (
    <Link
      href={`/games/find/${level.id}`}
      data-level-link
      draggable={false}
      className="hm-card"
      aria-label={`Play level ${index + 1}`}
      style={{ display: 'flex', width: 360, aspectRatio: '1 / 1', borderRadius: 40, background: '#fff', border: '8px solid #F2C9A8', boxShadow: '0 8px 0 #EADCC8', boxSizing: 'border-box', overflow: 'hidden', fontFamily: 'inherit' }}
    >
      {src ? <Pic src={src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <span aria-hidden="true" style={{ flex: 1, background: '#FCEFE2' }} />}
    </Link>
  );
}
