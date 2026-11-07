'use client';

import { useEffect, useRef } from 'react';

/**
 * Shown instead of "coming soon" when a child page could not load its content (network, database or migration
 * problem). The child sees a sad cloud and one big retry button (no reading needed); the short line is for the
 * grown-up (ADR-036 style). `error` goes to the console so the cause is not lost.
 */
export function LoadError({ error, onRetry }: { error?: unknown; onRetry: () => void }) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (error) console.error('[childPlayer] could not load content:', error);
    btn.current?.focus();
  }, [error]);
  return (
    <div role="alert" aria-label="Something went wrong. Try again." style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 40, color: '#8A6A5E' }}>
      <svg aria-hidden="true" width="220" height="220" viewBox="0 0 24 24" fill="none" stroke="#B8A196" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5 4.5 4.5 0 0 1 17 18z" />
        <path d="M9.5 13.5h.01M14.5 13.5h.01M10 16c1.3-.8 2.7-.8 4 0" />
      </svg>
      <button ref={btn} type="button" className="hm-tap" aria-label="Try again" onClick={onRetry} style={{ width: 160, height: 160, borderRadius: 80, border: 'none', background: '#fff', boxShadow: '0 10px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg aria-hidden="true" width="84" height="84" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></svg>
      </button>
      <div style={{ fontSize: 34, fontWeight: 600 }}>Something went wrong. Ask a grown-up.</div>
    </div>
  );
}
