'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import s from '@/components/admin/admin-ui.module.css';

export type ToastKind = 'success' | 'error' | 'warning';
export type ToastState = { id: number; kind: ToastKind; text: string };

/** How long a toast stays: errors and warnings are read more slowly than a plain "Saved". */
const DURATION: Record<ToastKind, number> = { success: 4000, warning: 7000, error: 7000 };

/** One toast at a time for a page. `show` replaces the current toast and restarts the timer. */
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const close = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((kind: ToastKind, text: string) => {
    if (timer.current) clearTimeout(timer.current);
    seq.current += 1;
    setToast({ id: seq.current, kind, text });
    timer.current = setTimeout(() => { timer.current = null; setToast(null); }, DURATION[kind]);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { toast, show, close };
}

const COLOR: Record<ToastKind, { fg: string; bg: string }> = {
  success: { fg: '#2F6B3C', bg: '#E8F3E4' },
  error: { fg: '#A8484F', bg: '#FBEDEE' },
  warning: { fg: '#7A5410', bg: '#FCF1D2' },
};

function Icon({ kind }: { kind: ToastKind }) {
  const common = { 'aria-hidden': true, width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', style: { flex: 'none' } } as const;
  if (kind === 'success') return <svg {...common} data-toast-icon="success"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>;
  if (kind === 'error') return <svg {...common} data-toast-icon="error"><circle cx="12" cy="12" r="10" /><path d="M12 7v6" /><path d="M12 16.6v.01" /></svg>;
  return <svg {...common} data-toast-icon="warning"><path d="M12 3.5l9.5 16.5h-19z" /><path d="M12 10v4.5" /><path d="M12 17.4v.01" /></svg>;
}

/** Pill-shaped toast, bottom right: icon, text, close button. Icon, text and border share one colour on a light background. */
export function Toast({ toast, onClose }: { toast: ToastState | null; onClose: () => void }) {
  if (!toast) return null;
  const c = COLOR[toast.kind];
  return (
    <div
      key={toast.id}
      role={toast.kind === 'error' ? 'alert' : 'status'}
      data-toast={toast.kind}
      className={s.toastPill}
      style={{ color: c.fg, background: c.bg, borderColor: c.fg }}
    >
      <Icon kind={toast.kind} />
      <span className={s.toastText}>{toast.text}</span>
      <button type="button" className={s.toastClose} aria-label="Close message" onClick={onClose}>
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>
      </button>
    </div>
  );
}
