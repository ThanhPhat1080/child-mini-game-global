'use client';

import { mediaUrl } from '@/lib/media';
import { SLOT_COLORS } from '@/lib/tokens';
import type { QuizQuestion } from '@/lib/quiz/playable';
import { Pic } from '@/components/Pic';

const BADGE = ['#C77D85', '#5F86A8', '#8A6A2A'];
const SHADOW = ['#D9A0A6', '#7FA0BE', '#D2B466'];

type Props = {
  question: QuizQuestion;
  /** Indexes (0-2) already tried and wrong in this question. */
  wrong: ReadonlySet<number>;
  /** Index (0-2) of the right answer once picked (it grows with a ring), else null. */
  picked: number | null;
  /** True while a pick is being celebrated; ignores every click. */
  locked: boolean;
  /** True while the prompt or an answer is being said; the speaker pulses softly. */
  speaking: boolean;
  /** Index of the answer being read aloud (read_answers), else null. */
  readIdx?: number | null;
  onPick: (i: number) => void;
  onReplay: () => void;
};

/** The Quiz question: prompt picture and text above numbered answers, laid out for the 1920 x 1080 stage like the quiz page. */
export function QuizAsk({ question, wrong, picked, locked, speaking, readIdx = null, onPick, onReplay }: Props) {
  const qImg = mediaUrl(question.prompt_image_path);
  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div style={{ position: 'absolute', top: 150, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 72 }}>
        {qImg && (
          <div data-prompt-image style={{ width: 300, height: 300, boxSizing: 'border-box', padding: 20, overflow: 'hidden', borderRadius: 44, background: '#fff', boxShadow: '0 12px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pic src={qImg} alt="" style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <button
            type="button"
            data-replay
            aria-label="Hear the question again"
            className={`hm-tap hm-ls-speaker${speaking ? ' hm-ls-speaking' : ''}`}
            onClick={onReplay}
            style={{ width: 120, height: 120, borderRadius: 60, border: 'none', background: '#EBB7BC', boxShadow: '0 10px 0 #D9A0A6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}
          >
            <svg aria-hidden="true" width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H3v6h3l5 4z" fill="#fff" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></svg>
          </button>
          {question.prompt_text && <span style={{ fontSize: 56, fontWeight: 500, color: '#8A6A5E', maxWidth: 620, lineHeight: 1.1, textAlign: 'center' }}>{question.prompt_text}</span>}
        </div>
      </div>

      <div className="hm-answers" style={{ position: 'absolute', top: 540, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 72 }}>
        {question.answers.map((a, i) => {
          const c = SLOT_COLORS[i];
          const isWrong = wrong.has(i);
          const isPicked = picked === i;
          const isReading = readIdx === i;
          const img = mediaUrl(a.image_path);
          const textOnly = !img; // no picture: the text is the card, so it is drawn even when "hide text" is on
          const showText = (!question.hide_answer_text || textOnly) && !!a.text?.trim(); // hidden text is still read aloud, just not drawn
          return (
            <button
              key={a.slot}
              type="button"
              data-answer
              data-wrong={isWrong ? 'true' : 'false'}
              aria-disabled={isWrong ? 'true' : undefined}
              aria-label={`Answer ${i + 1}`}
              className={`hm-ans${isWrong ? ' hm-ls-wrong hm-wobble' : ''}${isReading ? ' hm-reading' : ''}${isPicked ? ' hm-picked' : ''}`}
              onClick={() => { if (!locked && !isWrong) onPick(i); }}
              style={{ position: 'relative', width: 460, height: 400, borderRadius: 56, border: `14px solid ${c.ring}`, background: c.bg, boxShadow: `0 16px 0 ${SHADOW[i]}`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', opacity: isWrong ? 0.55 : readIdx !== null && !isReading ? 0.7 : 1, '--ring': c.ring } as React.CSSProperties}
            >
              {isPicked && <span className="hm-pickring" aria-hidden="true" style={{ borderColor: c.ring }} />}
              {isReading && (<><span className="hm-readring" aria-hidden="true" style={{ borderColor: c.ring }} /><span className="hm-bars" aria-hidden="true"><i /><i /><i /></span></>)}
              <span className="hm-num" style={{ position: 'absolute', top: -34, left: -34, width: 104, height: 104, borderRadius: 52, background: BADGE[i], color: '#fff', border: '8px solid #FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 56, fontWeight: 600, boxSizing: 'border-box' }}>{i + 1}</span>
              {img && <Pic src={img} alt="" style={{ width: '100%', height: 'auto', maxHeight: showText ? 250 : '100%', objectFit: 'contain' }} />}
              {showText && <span style={textOnly ? { textAlign: 'center', fontSize: 72, fontWeight: 600, lineHeight: 1.1, color: '#5A4038', overflowWrap: 'anywhere' } : { position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center', fontSize: 44, fontWeight: 600, color: '#5A4038' }}>{a.text}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
