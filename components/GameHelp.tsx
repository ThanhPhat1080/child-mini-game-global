'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';

export const ROSE = '#EBB7BC';
export const SKY = '#A9C6DE';
export const BUTTER = '#EED79A';
export const SOFT = '#8A6A5E';

export type Slide = { title: string; text: string; art: ReactNode };

const playStyle = { height: 120, padding: '0 44px', borderRadius: 60, background: '#C77D85', boxShadow: '0 8px 0 #A8636B', display: 'flex', alignItems: 'center', gap: 14, color: '#fff', fontSize: 48, fontWeight: 700, textDecoration: 'none' } as const;
const playIcon = <svg aria-hidden="true" width="48" height="48" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l10.5-6.5z" /></svg>;

const round = { width: 120, height: 120, borderRadius: 60, border: 'none', background: '#FBF4E9', boxShadow: '0 8px 0 #E3CFC0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 } as const;

/** Tutorial popup shell shared by the games: a carousel of steps with a last-step Play button. */
export function GameHelp({ label, playLabel, slides, onClose, playHref }: { /** Dialog name, e.g. "How to play Quiz". */ label: string; /** Name of the last-step Play button. */ playLabel: string; slides: Slide[]; onClose: () => void; /** Where "Play" goes; null when the popup is already on the game's own screen, so "Play" just closes it. */ playHref: string | null }) {
  const [i, setI] = useState(0);
  const count = slides.length;
  const dialog = useRef<HTMLDivElement>(null);
  const last = i === count - 1;
  const go = (n: number) => setI(Math.max(0, Math.min(count - 1, n)));

  useEffect(() => { dialog.current?.focus(); }, []);

  // keys belong to the popup while it is open (Esc must not also leave the page, arrows must not move the games)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'BrowserBack') { e.preventDefault(); e.stopPropagation(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); setI((v) => Math.min(count - 1, v + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); setI((v) => Math.max(0, v - 1)); }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose, count]);

  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'absolute', inset: 0, background: 'rgba(90,64,56,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="hm-pop"
        style={{ position: 'relative', width: 1280, height: 800, boxSizing: 'border-box', borderRadius: 72, background: '#fff', border: `14px solid ${ROSE}`, boxShadow: '0 20px 0 #E3CFC0', outline: 'none', display: 'flex', flexDirection: 'column', overflow: 'visible' }}
      >
        <button type="button" className="hm-tap" aria-label="Close" onClick={onClose} style={{ ...round, background: '#fff', boxShadow: '0 8px 0 #EADCC8', position: 'absolute', top: -48, right: -48, zIndex: 2 }}>
          <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        <div style={{ flex: 1, overflow: 'hidden', borderRadius: '58px 58px 0 0' }} aria-live="polite">
          <div style={{ display: 'flex', width: `${count * 100}%`, height: '100%', transform: `translateX(-${(i * 100) / count}%)`, transition: 'transform .6s cubic-bezier(.3,.7,.2,1)' }}>
            {slides.map((s, k) => (
              <section key={k} role="group" aria-roledescription="slide" aria-label={`${k + 1} of ${count}`} aria-hidden={k !== i} style={{ width: `${100 / count}%`, height: '100%', boxSizing: 'border-box', padding: '40px 90px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, textAlign: 'center' }}>
                <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{s.art}</div>
                <h2 style={{ margin: 0, fontSize: 76, fontWeight: 700, color: '#B8737B', lineHeight: 1.05 }}>{s.title}</h2>
                <p style={{ margin: 0, fontSize: 40, fontWeight: 500, color: SOFT, lineHeight: 1.3, maxWidth: 1000 }}>{s.text}</p>
              </section>
            ))}
          </div>
        </div>

        <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 40px 14px' }}>
          <button type="button" className="hm-tap" aria-label="Previous step" disabled={i === 0} onClick={() => go(i - 1)} style={{ ...round, opacity: i === 0 ? 0.4 : 1 }}>
            <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div role="group" aria-label="Pick a step" style={{ display: 'flex' }}>
            {slides.map((_, k) => (
              <button key={k} type="button" className="hm-tap" aria-label={`Go to step ${k + 1}`} aria-current={k === i} onClick={() => go(k)} style={{ width: 120, height: 120, padding: 0, border: 'none', background: 'none', borderRadius: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ display: 'block', height: 22, borderRadius: 11, transition: 'width .5s ease', width: k === i ? 56 : 22, background: k === i ? '#E59AA1' : '#E3D5C4' }} />
              </button>
            ))}
          </div>
          {last ? (
            playHref ? (
              <Link href={playHref} className="hm-tap" aria-label={playLabel} style={playStyle}>
                {playIcon}
                Play
              </Link>
            ) : (
              <button type="button" className="hm-tap" aria-label={playLabel} onClick={onClose} style={{ ...playStyle, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {playIcon}
                Play
              </button>
            )
          ) : (
            <button type="button" className="hm-tap" aria-label="Next step" onClick={() => go(i + 1)} style={round}>
              <svg aria-hidden="true" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
