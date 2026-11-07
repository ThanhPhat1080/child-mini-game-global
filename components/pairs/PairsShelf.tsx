'use client';

import { Pic } from '@/components/Pic';
import { mediaUrl } from '@/lib/media';
import { SHELF_PLACES, SHELF_SIZE, shelfXY } from '@/lib/pairs/geometry';
import type { PuzzlePicture } from '@/lib/pairs/types';
import s from './pairs.module.css';

/** H9: the four places above the board; each finished picture lands in the next free one. */
export function PairsShelf({ done }: { done: readonly PuzzlePicture[] }) {
  return (
    <div className={s.shelf} aria-hidden="true">
      {Array.from({ length: SHELF_PLACES }, (_, k) => {
        const p = shelfXY(k);
        const picture = done[k];
        const url = mediaUrl(picture?.image_path);
        return (
          <div key={k} data-shelf-place className={s.place} data-filled={picture ? 'true' : 'false'} style={{ left: p.x, top: p.y, width: SHELF_SIZE, height: SHELF_SIZE }}>
            {picture && (url ? <Pic src={url} alt="" width={150} height={150} draggable={false} /> : null)}
          </div>
        );
      })}
    </div>
  );
}
