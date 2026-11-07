'use client';

import { Pic } from '@/components/Pic';
import { mediaUrl } from '@/lib/media';
import type { PuzzlePicture, Side } from '@/lib/pairs/types';
import s from './pairs.module.css';

type Props = {
  id: string;
  side: Side;
  picture: PuzzlePicture | undefined;
  up: boolean;
  flipping: boolean;
  transform: string;
  dragging: boolean;
  target: boolean;
  joining: boolean;
  hitRef: (el: HTMLDivElement | null) => void;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
};

/** One half (H3, H7): the peach back when face down, half of the picture when face up. Never shows the word. */
export function PairsPiece(p: Props) {
  const url = mediaUrl(p.picture?.image_path);
  return (
    <div
      className={s.piece}
      data-piece={p.id}
      data-up={String(p.up)}
      data-dragging={p.dragging ? 'true' : undefined}
      data-target={p.target ? 'true' : undefined}
      data-joining={p.joining ? 'true' : undefined}
      style={{ transform: p.transform }}
    >
      <div
        ref={p.hitRef}
        data-hit
        data-side={p.side}
        data-up={String(p.up)}
        role="button"
        aria-label={p.up ? 'Picture piece' : 'Hidden piece'}
        tabIndex={0}
        className={`${s.hit}${p.flipping ? ` ${s.flipping}` : ''}`}
        onPointerDown={p.onPointerDown}
        onClick={p.onClick}
        onKeyDown={p.onKeyDown}
        onContextMenu={(e) => e.preventDefault()}
      >
        {p.up && (
          <div className={s.front}>
            {url ? <Pic src={url} alt="" width={300} height={300} draggable={false} /> : <div className={s.missing} />}
          </div>
        )}
        {(!p.up || p.flipping) && <div className={s.back} data-face="back" />}
      </div>
    </div>
  );
}
