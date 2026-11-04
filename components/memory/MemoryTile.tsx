'use client';

import { useState } from 'react';
import { mediaUrl } from '@/lib/media';
import type { DeckTile } from '@/lib/memory/deck';
import { FlowerBack } from './FlowerBack';
import { Pic } from '@/components/Pic';

type Props = {
  tile: DeckTile;
  faceUp: boolean;
  matched: boolean;
  onPress: () => void;
  /** Non-text-dependent name for assistive tech, e.g. "card 3". Never the card's word. */
  label: string;
  /** Short wiggle when a matched tile is pressed again (replay). */
  wiggle?: boolean;
  /** Square side in stage pixels. */
  size?: number;
};

/**
 * One Memory Match tile (M2/M3): a real button with a flower back and a picture front, no written word.
 * The picture is mounted from the first time the tile is face-up, so the flip-back still shows it.
 */
export function MemoryTile({ tile, faceUp, matched, onPress, label, wiggle = false, size = 200 }: Props) {
  const [seen, setSeen] = useState(faceUp);
  const [broken, setBroken] = useState(false);
  if (faceUp && !seen) setSeen(true);
  const src = mediaUrl(tile.card.image_path);
  const cls = ['hm-mt', faceUp && 'hm-mt-up', matched && 'hm-mt-matched', wiggle && 'hm-mt-wiggle'].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      data-tile
      data-card-id={tile.card.id}
      data-face-up={faceUp ? 'true' : 'false'}
      data-matched={matched ? 'true' : 'false'}
      aria-pressed={faceUp}
      aria-label={label}
      className={cls}
      onClick={onPress}
      style={{ width: size, height: size }}
    >
      <span className="hm-mt-inner">
        <span className="hm-mt-face hm-mt-back">
          <FlowerBack />
        </span>
        <span className="hm-mt-face hm-mt-front">
          {seen && (src && !broken ? (
            <Pic src={src} alt="" draggable={false} onError={() => setBroken(true)} />
          ) : (
            <svg data-placeholder aria-hidden="true" width="60%" height="60%" viewBox="0 0 10 10">
              <rect x="1" y="1" width="8" height="8" rx="2" fill="#EFE6DA" />
            </svg>
          ))}
        </span>
        {matched && <span className="hm-mt-sparkle" aria-hidden="true" />}
      </span>
    </button>
  );
}
