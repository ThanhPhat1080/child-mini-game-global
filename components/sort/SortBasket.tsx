'use client';

import type { Basket } from '@/lib/sort/rounds';
import type { MemoryCard } from '@/lib/memory/types';
import { SortPicture } from '@/components/sort/SortPicture';

type Props = {
  index: 0 | 1;
  basket: Basket;
  /** Cards already sorted into this basket (up to 3). */
  placed: readonly MemoryCard[];
  /** Tapping the example says its word. */
  onExampleTap: () => void;
  /** Gives the page the tray element, to find where a dropped card landed. */
  basketRef: (el: HTMLElement | null) => void;
};

const TONES = [
  { bg: '#FBF3D9', ring: '#EAD9A0', shadow: '#E3CFA0', slot: '#F5E8BC' },
  { bg: '#FBE3D6', ring: '#EDBFA6', shadow: '#E3B9A0', slot: '#F6D2BF' },
] as const;

/** A warm tray with an example card and three slots. The tray itself is the drop area. */
export function SortBasket({ index, basket, placed, onExampleTap, basketRef }: Props) {
  const t = TONES[index];
  const slotBox = { width: 150, height: 150, boxSizing: 'border-box', borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;
  return (
    <div
      data-basket={index}
      ref={basketRef}
      className="hm-so-basket"
      style={{ width: 760, height: 520, boxSizing: 'border-box', borderRadius: 72, background: t.bg, border: `14px solid ${t.ring}`, boxShadow: `0 20px 0 ${t.shadow}`, padding: '36px 44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <button
        type="button"
        data-basket-example
        aria-label="Example"
        className="hm-so-example"
        onClick={onExampleTap}
        style={{ ...slotBox, padding: 14, background: '#fff', border: `8px solid ${t.ring}`, boxShadow: `0 8px 0 ${t.shadow}`, cursor: 'pointer' }}
      >
        <SortPicture card={basket.example} />
      </button>
      <div style={{ display: 'flex', gap: 36 }}>
        {[0, 1, 2].map((k) => {
          const card = placed[k];
          return card ? (
            <div key={k} data-slot data-placed={card.id} style={{ ...slotBox, padding: 12, background: '#fff', border: `8px solid ${t.ring}`, boxShadow: `0 6px 0 ${t.shadow}` }}>
              <SortPicture card={card} />
            </div>
          ) : (
            <div key={k} data-slot style={{ ...slotBox, background: t.slot, border: `6px dashed ${t.ring}` }} />
          );
        })}
      </div>
    </div>
  );
}
