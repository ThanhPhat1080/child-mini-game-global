'use client';

import { useEffect, useRef, useState } from 'react';
import type { FindObject } from '@/lib/find/types';

/** How long the pop animation runs on a tapped row (matches .hm-find-pop in globals.css). */
const POP_MS = 350;

type Props = {
  objects: FindObject[];
  /** Index of the object being asked, or -1 when there is none (done). */
  current: number;
  found: readonly number[];
  /** Says the word of the object at this index. Does not change the game. */
  onSay: (index: number) => void;
};

/** The words of the level, in object order, beside the picture (F2, F3). The words come from the admin; the only other text is the object number in each name. */
export function FindWordList({ objects, current, found, onSay }: Props) {
  // Fewer words get bigger type; a long list shrinks it so every row stays on the stage.
  const wordSize = objects.length > 8 ? 32 : objects.length > 5 ? 38 : 44;
  const [popped, setPopped] = useState(-1);
  const popTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rows = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => () => { if (popTimer.current) clearTimeout(popTimer.current); }, []);

  // The asked word is kept in view when the list overflows.
  useEffect(() => {
    if (current < 0) return;
    rows.current[current]?.scrollIntoView?.({ block: 'nearest' });
  }, [current]);

  const say = (i: number) => {
    onSay(i);
    setPopped(i);
    if (popTimer.current) clearTimeout(popTimer.current);
    popTimer.current = setTimeout(() => { popTimer.current = null; setPopped(-1); }, POP_MS);
  };

  return (
    // Padding keeps the pop animation (scale 1.06) and the borders inside the scrolling column, so nothing is cut.
    <div data-find-list style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: 16, boxSizing: 'border-box' }}>
      {objects.map((o, i) => {
        const isCurrent = i === current;
        const isFound = found.includes(i);
        const isDim = !isCurrent && !isFound;
        const n = i + 1;
        return (
          <div
            key={i}
            ref={(el) => { rows.current[i] = el; }}
            data-find-row
            className={popped === i ? 'hm-find-pop' : undefined}
            onClick={() => say(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 18px 12px 12px',
              borderRadius: 32,
              background: isCurrent ? '#F7DCC4' : '#FFFBF6',
              border: `6px solid ${isCurrent ? '#B5703A' : '#F2C9A8'}`,
              boxSizing: 'border-box',
              boxShadow: isCurrent ? '0 6px 0 #EADCC8' : 'none',
              opacity: isDim ? 0.45 : isFound ? 0.7 : 1,
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <button
              type="button"
              aria-label={`Say word ${n}`}
              className="hm-tap"
              style={{ width: 64, height: 64, flex: 'none', borderRadius: 32, border: 'none', background: '#fff', boxShadow: '0 4px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}
            >
              <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#B5703A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 0 1 0 7" /></svg>
            </button>
            <button
              type="button"
              aria-label={`Object ${n}: ${o.word}`}
              data-current={isCurrent ? 'true' : 'false'}
              data-found={isFound ? 'true' : 'false'}
              data-dim={isDim ? 'true' : 'false'}
              style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
            >
              <span
                style={{ fontFamily: "'Baloo 2', 'Nunito', sans-serif", fontSize: wordSize, fontWeight: isCurrent ? 800 : 600, lineHeight: 1.1, color: '#7A5C50', overflowWrap: 'anywhere', minWidth: 0 }}
              >
                {o.word}
              </span>
              {isFound && (
                <svg aria-hidden="true" width="32" height="32" viewBox="0 0 24 24" style={{ flex: 'none' }}>
                  <path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="#B5703A" />
                </svg>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
