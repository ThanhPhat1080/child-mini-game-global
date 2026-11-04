'use client';

import { useId, useState, type KeyboardEvent } from 'react';
import type { EGroup } from '@/lib/memory/adminCards';
import { ConfirmDialog } from './ConfirmDialog';
import s from './admin-ui.module.css';
import { ghostBtn, inputStyle, panel } from './editor-parts';

const errText = { margin: 0, fontSize: 13, fontWeight: 700, color: '#A8484F' } as const;
const chip = { display: 'inline-flex', alignItems: 'center', gap: 2, height: 36, padding: '0 4px 0 14px', borderRadius: 18, background: '#FBF4E9', border: '1.5px solid #EADCC8', fontSize: 14, fontWeight: 700 } as const;
const iconBtn = { width: 30, height: 30, padding: 0, border: 'none', borderRadius: 15, background: 'transparent', color: '#7A6458', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const;
const small = { ...ghostBtn, height: 32, padding: '0 10px', fontSize: 13 } as const;

function Pencil() {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
}
function Cross() {
  return <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;
}

const usedBy = (n: number) =>
  n === 0 ? 'No card uses this group.' : n === 1 ? '1 card uses this group. It will have no group.' : `${n} cards use this group. They will have no group.`;

/** One chip being renamed inline: Enter or OK keeps the name, Escape or Cancel drops it. */
function RenameChip({ group, onRename, onClose }: { group: EGroup; onRename: (id: string, name: string) => string | null; onClose: () => void }) {
  const [value, setValue] = useState(group.name);
  const [err, setErr] = useState<string | null>(null);
  const errId = useId();
  const commit = () => {
    const e = onRename(group.id, value);
    if (e) setErr(e); else onClose();
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, maxWidth: '100%' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <input
          className={s.in} type="text" autoFocus aria-label={`New name for group ${group.name}`} value={value}
          aria-invalid={!!err} aria-describedby={err ? errId : undefined}
          onChange={(e) => { setValue(e.target.value); setErr(null); }} onKeyDown={key}
          style={{ ...inputStyle, height: 36, width: 150, maxWidth: '100%', boxSizing: 'border-box', fontSize: 14 }}
        />
        <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Confirm new name for group ${group.name}`} style={small} onClick={commit}>OK</button>
        <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Cancel renaming group ${group.name}`} style={small} onClick={onClose}>Cancel</button>
      </span>
      {err && <p id={errId} role="alert" style={errText}>{err}</p>}
    </span>
  );
}

/** A17: the groups of the card pool as tag chips, with add, inline rename and delete (after a confirmation). Edits are drafts until Save. */
export function GroupsPanel({ groups, onAdd, onRename, onDelete, usage }: {
  groups: readonly EGroup[];
  onAdd: (name: string) => string | null;
  onRename: (id: string, name: string) => string | null;
  onDelete: (id: string) => void;
  usage: ReadonlyMap<string, number>;
}) {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [doomed, setDoomed] = useState<EGroup | null>(null);
  const errId = useId();

  const add = () => {
    const e = onAdd(name);
    if (e) { setErr(e); return; }
    setName(''); setErr(null);
  };
  const key = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
    else if (e.key === 'Escape') { e.preventDefault(); setName(''); setErr(null); }
  };

  return (
    <section aria-labelledby="groups-h" style={{ ...panel, padding: '18px 22px', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h2 id="groups-h" style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>Groups</h2>
        <p style={{ margin: 0, fontSize: 13, color: '#7A6458' }}>Kinds of things for Sort It, e.g. animals or fruit. Pick a card&apos;s group on the card. Only you see these names.</p>
      </div>

      {groups.length ? (
        <ul aria-label="Groups" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {groups.map((g) => (
            <li key={g.id} style={{ maxWidth: '100%' }}>
              {renaming === g.id ? (
                <RenameChip group={g} onRename={onRename} onClose={() => setRenaming(null)} />
              ) : (
                <span style={chip}>
                  <span data-chip-name style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260, marginRight: 4 }}>{g.name}</span>
                  <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Rename group ${g.name}`} title="Rename" style={iconBtn} onClick={() => setRenaming(g.id)}><Pencil /></button>
                  <button type="button" className={`${s.btn} ${s.danger}`} aria-label={`Delete group ${g.name}`} title="Delete" style={{ ...iconBtn, color: '#A8484F' }} onClick={() => setDoomed(g)}><Cross /></button>
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 14, color: '#7A6458' }}>No groups yet. Add one below.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className={s.in} type="text" aria-label="New group name" placeholder="e.g. Animals" value={name}
            aria-invalid={!!err} aria-describedby={err ? errId : undefined}
            onChange={(e) => { setName(e.target.value); setErr(null); }} onKeyDown={key}
            style={{ ...inputStyle, height: 40, flex: '1 1 140px', maxWidth: 320, minWidth: 0, boxSizing: 'border-box' }}
          />
          <button type="button" className={`${s.btn} ${s.ghost}`} style={{ ...ghostBtn, height: 40 }} onClick={add}>Add group</button>
        </div>
        {err && <p id={errId} role="alert" style={errText}>{err}</p>}
      </div>

      {doomed && (
        <ConfirmDialog
          title={`Delete the group “${doomed.name}”?`}
          body={`${usedBy(usage.get(doomed.id) ?? 0)} The group is removed when you save. Revert brings it back until you save.`}
          button="Delete group"
          onCancel={() => setDoomed(null)}
          onConfirm={() => { onDelete(doomed.id); setDoomed(null); }}
        />
      )}
    </section>
  );
}
