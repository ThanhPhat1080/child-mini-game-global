'use client';

import s from './admin-ui.module.css';
import { ModalClose } from '@/components/ModalClose';

/**
 * Confirmation dialog. The default is the red delete look; `tone="neutral"` is for an action that is not a deletion
 * (publish, unpublish, send for review): a plain icon and the brown primary button.
 */
export function ConfirmDialog({ title, body, button, busy, tone = 'danger', onCancel, onConfirm }: { title: string; body: string; button: string; busy?: boolean; tone?: 'danger' | 'neutral'; onCancel: () => void; onConfirm: () => void }) {
  const neutral = tone === 'neutral';
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="dtitle" aria-describedby="dbody" style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 28, maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(74,56,48,0.3)', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <ModalClose onClick={onCancel} disabled={busy} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ flex: 'none', width: 48, height: 48, borderRadius: 24, background: neutral ? '#F3ECE3' : '#FBEDEE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {neutral ? (
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#5A4038" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            ) : (
              <svg aria-hidden="true" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A8484F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M6 6l1 14h10l1-14" /><path d="M10 11v5M14 11v5" /></svg>
            )}
          </span>
          <h2 id="dtitle" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>{title}</h2>
        </div>
        <p id="dbody" style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: '#6E5A4E' }}>{body}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
          <button type="button" autoFocus className={s.ghost} onClick={onCancel} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 14, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={busy} onClick={onConfirm} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: neutral ? '#5A4038' : '#A8484F', color: '#fff', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 14, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{button}</button>
        </div>
      </div>
    </div>
  );
}
