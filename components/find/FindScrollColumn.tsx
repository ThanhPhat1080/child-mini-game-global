'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

type Props = { reduced: boolean; children: ReactNode };

const arrow = (up: boolean) => (
  <svg aria-hidden="true" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#B5703A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
);

/**
 * The word column of Find It. When the words do not fit, there is no scrollbar: big Up and Down buttons
 * (mouse friendly) scroll the list instead. With few words nothing extra is shown.
 */
export function FindScrollColumn({ reduced, children }: Props) {
  const box = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState({ overflow: false, top: true, bottom: true });

  const measure = useCallback(() => {
    const el = box.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 1;
    const next = { overflow, top: el.scrollTop <= 1, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1 };
    setState((s) => (s.overflow === next.overflow && s.top === next.top && s.bottom === next.bottom ? s : next));
  }, []);

  useEffect(() => {
    measure();
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [measure]);

  const go = (dir: -1 | 1) => {
    const el = box.current;
    if (!el) return;
    el.scrollBy?.({ top: dir * Math.round(el.clientHeight * 0.8), behavior: reduced ? 'auto' : 'smooth' });
  };

  const btn = (dir: -1 | 1, disabled: boolean) => (
    <button
      type="button"
      data-find-scroll={dir < 0 ? 'up' : 'down'}
      aria-label={dir < 0 ? 'Up' : 'Down'}
      disabled={disabled}
      onClick={() => go(dir)}
      className="hm-tap"
      style={{ flex: 'none', height: 60, margin: dir < 0 ? '0 16px 6px' : '6px 16px 0', borderRadius: 30, border: '6px solid #F2C9A8', background: '#FFFBF6', boxShadow: disabled ? 'none' : '0 4px 0 #EADCC8', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, boxSizing: 'border-box' }}
    >
      {arrow(dir < 0)}
    </button>
  );

  return (
    <div data-find-col style={{ position: 'absolute', left: 40, top: 200, bottom: 56, width: 480, zIndex: 2, display: 'flex', flexDirection: 'column' }}>
      {state.overflow && btn(-1, state.top)}
      <div ref={box} data-find-scroll-area onScroll={measure} style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', scrollbarWidth: 'none' }}>
        {children}
      </div>
      {state.overflow && btn(1, state.bottom)}
    </div>
  );
}
