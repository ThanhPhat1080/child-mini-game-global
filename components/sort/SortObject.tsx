'use client';

import type { SortItem } from '@/lib/sort/rounds';
import { SortPicture } from '@/components/sort/SortPicture';

export type SortObjectState = 'idle' | 'lifted' | 'sliding' | 'hidden';

type Props = {
  item: SortItem;
  state: SortObjectState;
  /** Where the lifted card is, relative to its place, in stage pixels. */
  offset: { x: number; y: number };
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
};

/** A picture-only draggable card (200 px). The word is never written in it. */
export function SortObject({ item, state, offset, onPointerDown }: Props) {
  const hidden = state === 'hidden';
  const lifted = state === 'lifted';
  return (
    <div
      data-object
      data-card-id={item.card.id}
      data-state={state}
      role="button"
      aria-label="Object"
      aria-hidden={hidden ? 'true' : undefined}
      tabIndex={hidden ? -1 : 0}
      className={`hm-so-obj${state === 'sliding' ? ' hm-so-slide' : ''}${lifted ? ' hm-so-lifted' : ''}`}
      onPointerDown={onPointerDown}
      style={{
        position: 'relative',
        width: 200,
        height: 200,
        boxSizing: 'border-box',
        borderRadius: 40,
        background: '#fff',
        border: '10px solid #EAD9A0',
        boxShadow: lifted ? '0 30px 40px rgba(90,64,56,.3)' : '0 8px 0 #E3CFC0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        touchAction: 'none',
        userSelect: 'none',
        cursor: lifted ? 'grabbing' : 'grab',
        zIndex: lifted ? 20 : state === 'sliding' ? 10 : 1,
        visibility: hidden ? 'hidden' : 'visible',
        transform: lifted ? `translate(${offset.x}px, ${offset.y}px) scale(var(--so-lift, 1.08))` : undefined,
      }}
    >
      <SortPicture card={item.card} />
    </div>
  );
}
