'use client';

import { useEffect, useState } from 'react';
import ParentDetail from '@/components/admin/ParentDetail';
import { ModalClose } from '@/components/ModalClose';
import s from './admin-ui.module.css';

/**
 * A parent's profile over the current page: the same screen as /admin/parents/<id> (ban or restore, storage, children,
 * levels), for a quick look without leaving the list. Esc, the close button or a click outside closes it; Esc inside
 * a window opened on top of it (ban, remove, edit child) only closes that window.
 */
export function ParentProfileModal({ id, onClose }: { id: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (document.querySelectorAll('[role="dialog"], [role="alertdialog"]').length > 1) return;
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className={s.modalBackdrop}
      style={{ zIndex: 40 }}
      data-testid="parent-profile-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Parent profile"
        style={{ position: 'relative', background: '#FBF4E9', borderRadius: 22, padding: '56px 28px 24px', width: '100%', maxWidth: 1040, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Nunito, sans-serif', color: '#4A3830', boxShadow: '0 20px 60px rgba(74,56,48,0.3)' }}
      >
        <ModalClose onClick={onClose} />
        <ParentDetail id={id} embedded />
      </div>
    </div>
  );
}

/**
 * A parent's name as a link with a small "open" icon (a square with an arrow). It opens the profile over the page
 * instead of navigating away.
 */
export function ParentProfileLink({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={s.parentLink}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {name}
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
      </button>
      {open && <ParentProfileModal id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
