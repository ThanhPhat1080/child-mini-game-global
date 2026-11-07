'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { CelebrationScene } from '@/components/CelebrationScene';
import { Pic } from '@/components/Pic';
import { applause, playFile, speakKid, type SoundHandle } from '@/lib/sfx';
import { handleChoiceKey, isPressKey } from '@/lib/keynav';
import { mediaUrl } from '@/lib/media';
import { sayWord, stopWord } from '@/lib/memory/cards';
import type { PuzzlePicture } from '@/lib/pairs/types';

const btn = { width: 160, height: 160, borderRadius: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', padding: 0 } as const;
/** A finished picture in its white box. */
const BOX = 150;
const PIC = 118;

/** A finished picture in its white box. A button (H10): a tap, Enter or Space says its English word again. */
function FinishedPicture({ picture, onSay }: { picture: PuzzlePicture; onSay: (p: PuzzlePicture) => void }) {
  const url = mediaUrl(picture.image_path);
  return (
    <button
      type="button"
      data-done-picture={picture.id}
      aria-label={`Hear ${picture.word}`}
      className="hm-tap"
      onClick={() => onSay(picture)}
      onKeyDown={(e) => { if (isPressKey(e)) { e.preventDefault(); onSay(picture); } }}
      style={{ width: BOX, height: BOX, padding: 0, border: 'none', cursor: 'pointer', borderRadius: 36, background: '#fff', boxShadow: '0 8px 0 #E3CFC0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
    >
      {url
        ? <Pic src={url} alt="" width={PIC} height={PIC} draggable={false} style={{ width: PIC, height: PIC, objectFit: 'contain' }} />
        : <span data-placeholder aria-hidden="true" style={{ width: PIC, height: PIC, borderRadius: 24, background: '#F7ECCB' }} />}
    </button>
  );
}

/** Puzzle Pairs finish (H10): praise, the 4 finished pictures (each says its word), and two picture buttons (New level, Back to games). */
export function PairsDone({ pictures, childName, completeUrl, onAgain, onHome }: {
  pictures: readonly PuzzlePicture[]; childName: string; completeUrl: string | null; onAgain: () => void; onHome: () => void;
}) {
  const greeting = `You did it${childName ? `, ${childName}` : ''}!`;

  const spoken = useRef(false);
  /** The praise sound, kept so leaving the finish (New level, Back, Esc) can stop it. Never stopped in an effect cleanup: StrictMode runs that right after mount. */
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

  // The word a finished picture says (H10). Leaving the finish stops it, but only once a word was said: a StrictMode
  // mount runs effect cleanups too, and must not cut off the greeting.
  const wordSaid = useRef(false);
  const sayPicture = (p: PuzzlePicture) => {
    stopPraise();
    wordSaid.current = true;
    sayWord({ word: p.word, audio_path: p.audio_path });
  };
  useEffect(() => () => { if (wordSaid.current) stopWord(); }, []);

  // A layout effect, so the keys are live in the same task that autoFocus puts the focus on New level.
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stopPraise(); onHome(); }
      else handleChoiceKey(e, Array.from(document.querySelectorAll<HTMLElement>('[data-done-picture], [data-done-btn]')));
    };
    window.addEventListener('keydown', onKey);
    const el = root.current;
    el?.setAttribute('data-keys', 'ready');
    return () => { window.removeEventListener('keydown', onKey); el?.removeAttribute('data-keys'); };
  }, [onHome]);

  return (
    <div ref={root} data-pairs-done style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
      <CelebrationScene greeting={greeting} extra={
        <div data-done-pictures style={{ display: 'flex', gap: 28 }}>
          {pictures.map((p) => <FinishedPicture key={p.id} picture={p} onSay={sayPicture} />)}
        </div>
      }>
        <button type="button" data-done-btn autoFocus onClick={() => { stopPraise(); onAgain(); }} className="hm-tap" aria-label="New level" style={{ ...btn, background: '#9CC3A4', boxShadow: '0 12px 0 #7FA889' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
        </button>
        <button type="button" data-done-btn onClick={() => { stopPraise(); onHome(); }} className="hm-tap" aria-label="Back to games" style={{ ...btn, background: '#fff', boxShadow: '0 12px 0 #EADCC8' }}>
          <svg aria-hidden="true" width="80" height="80" viewBox="0 0 24 24" fill="#B8737B" stroke="#B8737B" strokeWidth="1" strokeLinejoin="round"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
        </button>
      </CelebrationScene>
    </div>
  );
}
