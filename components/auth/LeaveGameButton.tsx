'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ModalClose } from '@/components/ModalClose';
import { Pic } from '@/components/Pic';
import { stopMusic } from '@/lib/audio';
import { clearActiveChild } from '@/lib/childSession';
import { GENDER_THEME } from '@/lib/childTheme';
import { stepFocus } from '@/lib/keynav';
import { trapTab } from '@/lib/trapTab';
import { useActiveChild } from '@/lib/useActiveChild';
import play from '../play/play.module.css';
import auth from './auth.module.css';

/**
 * Leave game (FP11-FP13). The corner button opens "Leave game?". Stay, X, Esc or a click outside keeps the child
 * in the game. Leave stops the music, forgets the child and goes to the picker. No sum: a child can see this screen.
 */
export default function LeaveGameButton() {
  const router = useRouter();
  const child = useActiveChild();
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const leaveChoice = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const theme = GENDER_THEME[child.gender ?? 'female'];

  useEffect(() => {
    if (open) stay.current?.focus();
  }, [open]);

  function close() {
    flushSync(() => setOpen(false));
    btn.current?.focus();
  }

  function leave() {
    stopMusic();
    clearActiveChild();
    router.push('/play');
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (stay.current && leaveChoice.current) stepFocus([stay.current, leaveChoice.current], e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (panel.current) trapTab(e, panel.current);
  }

  return (
    <>
      <button ref={btn} type="button" className={auth.leave} aria-label="Leave game" onClick={() => setOpen(true)}>
        <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
          <path d="M16 8l4 4-4 4" />
          <path d="M20 12H10" />
        </svg>
      </button>
      {open && (
        <div className={play.overlay} data-leave-overlay onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div
            ref={panel}
            className={play.panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{ position: 'relative', background: '#fff', borderColor: theme.accent }}
            onKeyDown={onKey}
          >
            <ModalClose size="child" onClick={close} />
            <span className={play.avatar} aria-hidden="true" style={{ color: theme.text, width: 220, height: 220, fontSize: 120, border: `10px solid ${theme.accent}` }}>
              {child.avatarUrl ? <Pic src={child.avatarUrl} alt="" /> : [...child.name.trim()][0]?.toUpperCase()}
            </span>
            <h2 id={titleId} className={play.pinTitle} style={{ color: theme.text }}>Leave game?</h2>
            <div className={play.leaveRow}>
              <button ref={stay} type="button" className={`hm-tap ${play.stayBtn}`} onClick={close}>
                <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="#fff" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round">
                  <path d="M8 5.5v13l10.5-6.5z" />
                </svg>
                Stay
              </button>
              <button ref={leaveChoice} type="button" className={`hm-tap ${play.leaveBtn}`} onClick={leave}>
                <svg aria-hidden="true" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4" />
                  <path d="M16 8l4 4-4 4" />
                  <path d="M20 12H10" />
                </svg>
                Leave
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
