import s from '@/components/admin/admin-ui.module.css';
import { RevertButton, SaveButton } from '@/components/admin/SaveButtons';

/** Cards page header controls (A12, A11): Quick import cards (only when `onImport` is given), Revert, Save. The Spot levels page reuses it without import, on one wrapping row. */
export function CardsHeaderActions(p: { dirty: boolean; busy: boolean; canSave: boolean; onImport?: () => void; onAdd?: () => void; onRevert: () => void; onSave: () => void }) {
  const font = 'Nunito, sans-serif';
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center', gap: 10 }}>
      {p.onImport && <button type="button" onClick={p.onImport} disabled={p.busy} className={`${s.btn} ${s.textBtn}`} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: 'none', color: '#3F73B5', fontSize: 14, fontWeight: 700, fontFamily: font, cursor: 'pointer', opacity: p.busy ? 0.5 : 1 }}>Quick import cards</button>}
      {p.onAdd && <button type="button" onClick={p.onAdd} disabled={p.busy} className={s.btn} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: '#3F73B5', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: font, cursor: 'pointer', opacity: p.busy ? 0.6 : 1 }}>Add level</button>}
      <RevertButton saving={p.busy} dirty={p.dirty} onClick={p.onRevert} />
      <SaveButton saving={p.busy} enabled={p.canSave} onClick={p.onSave} />
    </div>
  );
}
