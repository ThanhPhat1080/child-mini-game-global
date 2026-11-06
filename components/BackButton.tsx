'use client';

import Link from 'next/link';
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ModalClose } from '@/components/ModalClose';
import { GameIcon } from '@/components/games/GameArt';
import type { Game } from '@/lib/games/registry';
import { stepFocus } from '@/lib/keynav';
import { trapTab } from '@/lib/trapTab';

const ASK_CSS = `
  .back-ask button:focus-visible { outline: 6px solid #7A5C50; outline-offset: 6px; }
`;

/**
 * Round back (or home) button; Esc / Back key also goes back (C8).
 * On a play screen (`game` set) a click on the button asks "Leave now?" first: Yes goes back, No, X, Esc or a
 * click outside stays. Pickers (the game list, level and set lists) do not pass `game`, so they go back at once.
 * Esc and the Back key do the same: on a play screen they ask, on a picker they go back, and while the question is
 * open they close it (No).
 */
export function BackButton({ href, label = 'Back', home = false, game }: { href: string; label?: string; home?: boolean; game?: Game['id'] }) {
  const router = useRouter();
  const link = useRef<HTMLAnchorElement>(null);
  const [asking, setAsking] = useState(false);
  // Read by the window listener, which is set up once: while the question is open, the question handles Esc.
  const askingNow = useRef(false);
  askingNow.current = asking;
  function onNo() {
    setAsking(false);
    // Back to the button, so a keyboard player stays where they were.
    setTimeout(() => link.current?.focus(), 0);
  }
  // Read by the window listener, which is set up once.
  const onNoNow = useRef(onNo);
  onNoNow.current = onNo;

  // Esc and the Back key do what the button does: an open question closes (No), a play screen asks, a picker goes back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || (e.key !== 'Escape' && e.key !== 'BrowserBack')) return;
      if (askingNow.current) onNoNow.current();
      else if (game) setAsking(true);
      else router.push(href);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [href, router, game]);

  return (
    <>
      <Link
        ref={link}
        href={href}
        className="hm-tap"
        aria-label={label}
        onClick={game ? (e) => { e.preventDefault(); setAsking(true); } : undefined}
        style={{ width: 104, height: 104, borderRadius: 52, background: '#fff', boxShadow: '0 6px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        {home ? (
          <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
        ) : (
          <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        )}
      </Link>
      {asking && game && <LeaveAsk game={game} onYes={() => router.push(href)} onNo={onNo} />}
    </>
  );
}

/**
 * "Leave now?" over a faint light backdrop: the game's icon, No (stays, on the left) and Yes (light pink, goes back).
 * X at the top left, a click outside, Esc and No all stay. Left and Right move between No and Yes.
 * The backdrop is `fixed`, so it covers the whole 1920x1080 stage (its transform is the containing block).
 */
function LeaveAsk({ game, onYes, onNo }: { game: Game['id']; onYes(): void; onNo(): void }) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const yes = useRef<HTMLButtonElement>(null);
  const no = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    no.current?.focus();
  }, []);

  function onKey(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onNo();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (yes.current && no.current) stepFocus([no.current, yes.current], e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (panel.current) trapTab(e, panel.current);
  }

  return (
    <div
      data-leave-ask
      onMouseDown={(e) => { if (e.target === e.currentTarget) onNo(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(251, 244, 233, 0.72)', backdropFilter: 'blur(6px)' }}
    >
      <style>{ASK_CSS}</style>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="back-ask"
        onKeyDown={onKey}
        style={{ position: 'relative', width: 720, boxSizing: 'border-box', padding: '72px 56px 56px', borderRadius: 72, background: '#fff', boxShadow: '0 16px 0 #EADCC8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 36 }}
      >
        <ModalClose size="child" side="left" onClick={onNo} />
        <div style={{ position: 'relative', width: 220, height: 220 }} aria-hidden="true">
          <div style={{ position: 'absolute', left: 0, top: 0, transform: 'scale(2)', transformOrigin: 'top left' }}>
            <GameIcon id={game} />
          </div>
        </div>
        <h2 id={titleId} style={{ margin: 0, fontSize: 60, fontWeight: 600, lineHeight: 1.1, color: '#5A4038', textAlign: 'center' }}>Leave now?</h2>
        <div style={{ display: 'flex', gap: 32 }}>
          <button
            ref={no}
            type="button"
            className="hm-tap"
            onClick={onNo}
            style={{ height: 120, padding: '0 56px', borderRadius: 60, border: '6px solid #E3D5C4', background: '#fff', color: '#5A4038', boxShadow: '0 10px 0 #EADCC8', fontSize: 52, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            No
          </button>
          <button
            ref={yes}
            type="button"
            className="hm-tap"
            onClick={onYes}
            style={{ height: 120, padding: '0 56px', borderRadius: 60, border: 'none', background: '#F8DCDF', color: '#7A3A44', boxShadow: '0 10px 0 #E59AA1', fontSize: 52, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
}
