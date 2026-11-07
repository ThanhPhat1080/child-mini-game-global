'use client';

import { useState } from 'react';
import { BAN_REASONS } from '@/lib/policy/reasons';
import s from './admin-ui.module.css';
import { selectArrowStyle } from './selectArrow';
import { ModalClose } from '@/components/ModalClose';

/** Ban dialog (N9, U15): a reason from the content policy is required; the note is optional. */
export function BanDialog({ name, busy, onCancel, onConfirm }: {
  name: string; busy?: boolean; onCancel: () => void; onConfirm: (code: string, note: string) => void;
}) {
  const [code, setCode] = useState('');
  const [note, setNote] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(74,56,48,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, boxSizing: 'border-box', zIndex: 50 }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ban-title" style={{ position: 'relative', background: '#fff', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'Nunito, sans-serif', color: '#4A3830' }}>
        <ModalClose onClick={onCancel} disabled={busy} />
        <h2 id="ban-title" style={{ margin: 0, fontSize: 21, fontWeight: 700 }}>Ban {name || 'this parent'}?</h2>
        <p style={{ margin: 0, fontSize: 15, color: '#6E5A4E' }}>All their content is hidden from everyone. Their children can still sign in. You can unban at any time.</p>
        <label htmlFor="ban-reason" style={{ fontSize: 14, fontWeight: 700 }}>Reason</label>
        <select id="ban-reason" value={code} onChange={(e) => setCode(e.target.value)} style={{ height: 44, borderRadius: 10, padding: '0 10px', fontSize: 15, ...selectArrowStyle }}>
          <option value="">Choose a reason…</option>
          {BAN_REASONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <label htmlFor="ban-note" style={{ fontSize: 14, fontWeight: 700 }}>Note for the parent (optional)</label>
        <textarea id="ban-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className={s.ghost} onClick={onCancel} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontWeight: 700, fontFamily: 'Nunito, sans-serif', fontSize: 15, cursor: 'pointer' }}>Cancel</button>
          <button type="button" disabled={!code || busy} onClick={() => onConfirm(code, note.trim())} style={{ height: 44, padding: '0 20px', borderRadius: 12, border: 'none', background: '#A8484F', color: '#fff', fontWeight: 700, fontSize: 15, cursor: 'pointer', opacity: !code || busy ? 0.6 : 1 }}>Ban</button>
        </div>
      </div>
    </div>
  );
}
