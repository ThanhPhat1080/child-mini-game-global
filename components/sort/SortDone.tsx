'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { CelebrationScene } from '@/components/CelebrationScene';
import { applause, playFile, speakKid, type SoundHandle } from '@/lib/sfx';
import { handleChoiceKey } from '@/lib/keynav';

const btn = { width: 160, height: 160, borderRadius: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', padding: 0 } as const;

/** Sort It finish (R7): praise, "Wrong N times", two picture buttons (Play again, Back to games). Nothing is stored. */
export function SortDone({ wrong, childName, completeUrl, onAgain, gamesHref }: {
  wrong: number; childName: string; completeUrl: string | null; onAgain: () => void; gamesHref: string;
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
    praise.current = applause(3) ?? null;
    speakKid(greeting, { pitch: 1.9, rate: 0.9 });
  }, [completeUrl, greeting]);

  // A layout effect, so the keys are live in the same task that autoFocus puts the focus on Play again.
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
    <div ref={root} data-sort-done style={{ position: 'absolute', inset: 0, zIndex: 5 }}>
      <CelebrationScene greeting={greeting} extra={
        <p data-wrong-line style={{ margin: 0, fontSize: 60, fontWeight: 600, color: '#7A5C50' }}>
          Wrong <strong data-wrong-total style={{ fontSize: 88, fontWeight: 600, color: '#B8737B', background: '#F7ECCB', borderRadius: 36, padding: '0 28px' }}>{wrong}</strong> times
        </p>
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
