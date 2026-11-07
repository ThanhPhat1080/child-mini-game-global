'use client';

import { useMemo, useRef } from 'react';
import { parsePieceId } from '@/lib/pairs/board';
import { pieceXY, shelfXY, wholeXY } from '@/lib/pairs/geometry';
import type { PuzzlePicture } from '@/lib/pairs/types';
import { PairsPiece } from './PairsPiece';
import { usePairsDrag } from './usePairsDrag';
import s from './pairs.module.css';

export type Joining = { a: string; b: string; phase: 'slide' | 'fly'; shelfIndex: number };

export type BoardProps = {
  pictures: ReadonlyMap<string, PuzzlePicture>;
  order: readonly string[];
  up: ReadonlySet<string>;
  /** Piece id playing the flip animation. */
  flipping: string | null;
  /** Join animating or modal open: presses ignored. */
  busy: boolean;
  /** The pair being joined: `slide` onto the target's slot, then `fly` to shelf place `shelfIndex`. */
  joining: Joining | null;
  stageRef: React.RefObject<HTMLElement | null>;
  /** Tap, Enter or Space on a face-down half. */
  onOpen: (pieceId: string) => void;
  /** The order after the halves made room. */
  onMove: (order: string[]) => void;
  /** Only called for the two halves of one picture. */
  onJoin: (dragId: string, targetId: string) => void;
};

const tr = (p: { x: number; y: number }) => `translate(${p.x}px, ${p.y}px)`;

/** The 2 x 4 board of halves (H3, H8, H9, H11). */
export function PairsBoard(props: BoardProps) {
  const { pictures, order, up, flipping, busy, joining, stageRef, onOpen, onMove, onJoin } = props;
  const locked = busy || !!joining;
  const { dragging, preview, target, press } = usePairsDrag({ stageRef, busy: locked, order, up, onMove, onJoin });
  const hits = useRef(new Map<string, HTMLDivElement>());

  const layout = useMemo(() => {
    if (joining?.phase === 'fly') return order.filter((id) => id !== joining.a && id !== joining.b);
    return preview ?? order;
  }, [order, preview, joining]);
  // A stable DOM order, so a moving half keeps its element and its slide transition.
  const ids = useMemo(() => [...order].sort(), [order]);

  const transformOf = (id: string): string => {
    const { side } = parsePieceId(id);
    if (joining && (id === joining.a || id === joining.b)) {
      if (joining.phase === 'slide') return tr(wholeXY(order.indexOf(joining.b)));
      return `${tr(shelfXY(joining.shelfIndex))} scale(0.5)`;
    }
    if (dragging?.id === id) {
      const home = pieceXY(side, order.indexOf(id));
      return tr({ x: home.x + dragging.dx, y: home.y + dragging.dy });
    }
    return tr(pieceXY(side, layout.indexOf(id)));
  };

  const focusAt = (i: number) => {
    const id = layout[(i + layout.length) % layout.length];
    hits.current.get(id)?.focus();
  };

  const onKey = (id: string, e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = layout.indexOf(id);
    if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey && i < layout.length - 1)) {
      e.preventDefault();
      focusAt(i + 1);
    } else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey && i > 0)) {
      e.preventDefault();
      focusAt(i - 1);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!locked && !up.has(id)) onOpen(id);
    }
  };

  return (
    <div className={s.board}>
      {ids.map((id) => {
        const { pictureId, side } = parsePieceId(id);
        const isUp = up.has(id);
        return (
          <PairsPiece
            key={id}
            id={id}
            side={side}
            picture={pictures.get(pictureId)}
            up={isUp}
            flipping={flipping === id}
            transform={transformOf(id)}
            dragging={dragging?.id === id}
            target={target === id}
            joining={!!joining && (id === joining.a || id === joining.b)}
            hitRef={(el) => {
              if (el) hits.current.set(id, el);
              else hits.current.delete(id);
            }}
            onPointerDown={(e) => {
              if (isUp && !locked) press(id, e);
            }}
            onClick={() => {
              if (!locked && !isUp) onOpen(id);
            }}
            onKeyDown={(e) => onKey(id, e)}
          />
        );
      })}
    </div>
  );
}
