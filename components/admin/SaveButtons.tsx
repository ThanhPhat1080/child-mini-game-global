import s from '@/components/admin/admin-ui.module.css';

const font = 'Nunito, sans-serif';

/** Save: "Saving…" with a small spinner and disabled while `saving`; otherwise disabled unless `enabled`. */
export function SaveButton({ saving, enabled, onClick, label = 'Save' }: { saving: boolean; enabled: boolean; onClick: () => void; label?: string }) {
  const off = saving || !enabled;
  return (
    <button type="button" onClick={onClick} disabled={off} aria-busy={saving} className={s.btn} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: 'none', background: '#5A4038', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: font, cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {saving && <span className={s.spinner} aria-hidden="true" />}
      {saving ? 'Saving…' : label}
    </button>
  );
}

/** Revert: disabled when nothing changed and while a save is running. */
export function RevertButton({ saving, dirty, onClick }: { saving: boolean; dirty: boolean; onClick: () => void }) {
  const off = saving || !dirty;
  return (
    <button type="button" onClick={onClick} disabled={off} className={`${s.btn} ${s.ghost}`} style={{ height: 40, padding: '0 18px', borderRadius: 10, border: '1.5px solid #E3D5C4', background: '#fff', color: '#4A3830', fontSize: 14, fontWeight: 700, fontFamily: font, cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.5 : 1 }}>Revert</button>
  );
}
