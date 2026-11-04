'use client';

import { useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { SLOT_COLORS } from '@/lib/tokens';
import type { Question } from '@/lib/listen/rounds';
import type { MemoryCard } from '@/lib/memory/types';
import { Pic } from '@/components/Pic';

const BADGE = ['#C77D85', '#5F86A8', '#8A6A2A'];
const SHADOW = ['#D9A0A6', '#7FA0BE', '#D2B466'];

type Props = {
  question: Question;
  /** Indexes (0-2) already tried and wrong in this question. */
  wrong: ReadonlySet<number>;
  /** Index (0-2) of the right answer once picked (it grows with a ring), else null. */
  picked?: number | null;
  /** True while a pick is being celebrated; ignores every click. */
  locked: boolean;
  /** True while the word is being said; the speaker pulses softly. */
  speaking: boolean;
  onPick: (i: 0 | 1 | 2) => void;
  onReplay: () => void;
};

function Picture({ card }: { card: MemoryCard }) {
  const [broken, setBroken] = useState(false);
  const src = mediaUrl(card.image_path);
  if (!src || broken) {
    return <span data-placeholder aria-hidden="true" style={{ display: 'block', width: '70%', height: '70%', borderRadius: 32, background: '#EFE6DA' }} />;
  }
  return <Pic src={src} alt="" draggable={false} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
}

/** The Listen & Pick question: a big speaker above three picture-only answers (no written word anywhere). */
export function ListenQuestion({ question, wrong, picked, locked, speaking, onPick, onReplay }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          data-replay
          aria-label="Hear the word again"
          className={`hm-tap hm-ls-speaker${speaking ? ' hm-ls-speaking' : ''}`}
          onClick={onReplay}
          style={{ width: 240, height: 240, borderRadius: 120, border: '14px solid #E59AA1', background: '#F8DCDF', boxShadow: '0 16px 0 #D9A0A6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}
        >
          <svg aria-hidden="true" width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="#C77D85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 5L6 9H3v6h3l5 4z" fill="#C77D85" />
            <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            <path d="M18.5 5.5a9 9 0 0 1 0 13" />
          </svg>
        </button>
      </div>

      <div className="hm-answers" style={{ position: 'absolute', top: 540, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 72 }}>
        {question.options.map((card, i) => {
          const c = SLOT_COLORS[i];
          const isWrong = wrong.has(i);
          const isPicked = picked === i;
          return (
            <button
              key={i}
              type="button"
              data-answer
              data-card-id={card.id}
              data-wrong={isWrong ? 'true' : 'false'}
              aria-disabled={isWrong ? 'true' : undefined}
              aria-label={`Answer ${i + 1}`}
              className={`hm-ans${isWrong ? ' hm-ls-wrong hm-wobble' : ''}${isPicked ? ' hm-picked' : ''}`}
              onClick={() => { if (!locked && !isWrong) onPick(i as 0 | 1 | 2); }}
              style={{ position: 'relative', width: 460, height: 400, borderRadius: 56, border: `14px solid ${c.ring}`, background: c.bg, boxShadow: `0 16px 0 ${SHADOW[i]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', opacity: isWrong ? 0.45 : 1, '--ring': c.ring } as React.CSSProperties}
            >
              {isPicked && <span className="hm-pickring" aria-hidden="true" style={{ borderColor: c.ring }} />}
              <span className="hm-num" style={{ position: 'absolute', top: -34, left: -34, width: 104, height: 104, borderRadius: 52, background: BADGE[i], color: '#fff', border: '8px solid #FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 600, boxSizing: 'border-box' }}>{i + 1}</span>
              <Picture card={card} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
