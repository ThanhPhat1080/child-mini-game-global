'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CelebrationScene } from '@/components/CelebrationScene';
import { applause, playFile, speakKid, type SoundHandle } from '@/lib/sfx';
import { handleChoiceKey } from '@/lib/keynav';
import { sayWord } from '@/lib/memory/cards';
import { mediaUrl } from '@/lib/media';
import { totalWrong, type WrongEntry } from '@/lib/listen/wrongLog';
import type { MemoryCard } from '@/lib/memory/types';
import { Pic } from '@/components/Pic';

const btn = { width: 160, height: 160, borderRadius: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', padding: 0 } as const;
const PIC = 96;

function AnswerPic({ card }: { card: MemoryCard | undefined }) {
  const [broken, setBroken] = useState(false);
  const src = card ? mediaUrl(card.image_path) : null;
  const box = { width: PIC, height: PIC, borderRadius: PIC / 2, background: '#fff', border: '6px solid #EADCC8', boxSizing: 'border-box', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' } as const;
  if (!src || broken) return <span data-placeholder aria-hidden="true" style={{ ...box, background: '#EFE6DA' }} />;
  return (
    <span style={box}>
      <Pic src={src} alt="" draggable={false} onError={() => setBroken(true)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
    </span>
  );
}

/** Listen & Pick finish (L6, L7): praise, "Wrong N times" and the wrong-picks row for the parent, two picture buttons. */
export function ListenDone({ wrong, cards, childName, completeUrl, onAgain, gamesHref }: {
  wrong: readonly WrongEntry[]; cards: ReadonlyMap<string, MemoryCard>; childName: string; completeUrl: string | null; onAgain: () => void; gamesHref: string;
}) {
  const router = useRouter();
  const greeting = `You did it${childName ? `, ${childName}` : ''}!`;

  const spoken = useRef(false);
  /** The praise sound, kept so leaving the finish (Play again, Back, Esc) can stop it. Never stopped in an effect cleanup: StrictMode runs that right after mount. */
  const praise = useRef<SoundHandle | null>(null);
  const stopPraise = () => {
    try { praise.current?.stop(); } catch { /* already stopped */ }
    praise.current = null;
  };
  useEffect(() => {
    if (spoken.current) return;
    spoken.current = true;
    if (completeUrl) { praise.current = playFile(completeUrl) ?? null; return; }
    praise.current = applause(3, () => speakKid(greeting, { pitch: 1.9, rate: 0.9 })) ?? null;
  }, [completeUrl, greeting]);

  // A layout effect, so the keys are live in the same task that autoFocus puts the focus on Play again
  // (a passive effect can run later, and a key pressed in between would be lost).
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stopPraise(); router.push(gamesHref); }
      else handleChoiceKey(e, Array.from(document.querySelectorAll<HTMLElement>('[data-done-btn]')));
    };
    window.addEventListener('keydown', onKey);
    const el = root.current;
    el?.setAttribute('data-keys', 'ready');
    return () => { window.removeEventListener('keydown', onKey); el?.removeAttribute('data-keys'); };
  }, [router, gamesHref]);

  return (
    <div ref={root} data-listen-done style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
      <CelebrationScene greeting={greeting} extra={
        <>
          <p data-wrong-line style={{ margin: 0, fontSize: 60, fontWeight: 600, color: '#7A5C50' }}>
            Wrong <strong data-wrong-total style={{ fontSize: 88, fontWeight: 600, color: '#B8737B', background: '#F7ECCB', borderRadius: 36, padding: '0 28px' }}>{totalWrong(wrong)}</strong> times
          </p>
          {wrong.length > 0 && (
            <div data-wrong-list style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 28px', maxWidth: 800, marginTop: -16 }}>
              {wrong.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  data-wrong-item
                  className="hm-tap"
                  aria-label={`Hear ${e.word}`}
                  onClick={() => sayWord(cards.get(e.id) ?? { word: e.word, audio_path: null })}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 128, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', color: '#7A5C50' }}
                >
                  <AnswerPic card={cards.get(e.id)} />
                  <span style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.1, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.word}{e.count > 1 && <span style={{ color: '#B8737B' }}> x{e.count}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      }>
        <button type="button" data-done-btn autoFocus onClick={() => { stopPraise(); onAgain(); }} className="hm-tap" aria-label="Play again" style={{ ...btn, background: '#9CC3A4', boxShadow: '0 12px 0 #7FA889' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        </button>
        <Link href={gamesHref} data-done-btn onClick={stopPraise} className="hm-tap" aria-label="Back to games" style={{ ...btn, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="#B8737B" stroke="#B8737B" strokeWidth="1" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
        </Link>
      </CelebrationScene>
    </div>
  );
}
