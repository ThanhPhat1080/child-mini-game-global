'use client';

import { useState } from 'react';
import { isCardComplete, type ECard, type EGroup } from '@/lib/memory/adminCards';
import { mediaUrl } from '@/lib/media';
import { LEVELS, levelsAvailable, pairsOf } from '@/lib/memory/deck';
import s from './admin-ui.module.css';
import { selectArrowStyle } from './selectArrow';
import { LibraryButton } from './LibraryButton';
import { PicIcon, dangerBtn, fileName, ghostBtn, inputStyle, panel } from './editor-parts';
import { Pic } from '@/components/Pic';
import { EditLock } from './EditLock';
import { ShareToggle } from './ShareToggle';
import { VisibilityBadge } from './VisibilityBadge';
import { lockedOwn, type Visibility } from '@/lib/review';

export const WORD_MAX = 40;
/** Accepted picture and pronunciation files (A11). */
export const CARD_IMG_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
/** Sound types the browser may report -> the name the media bucket allows (audio/mpeg, audio/mp4, audio/wav). */
const AUDIO_ALIASES: Record<string, string> = {
  'audio/mpeg': 'audio/mpeg', 'audio/mp3': 'audio/mpeg',
  'audio/mp4': 'audio/mp4', 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4',
  'audio/wav': 'audio/wav', 'audio/x-wav': 'audio/wav', 'audio/wave': 'audio/wav', 'audio/vnd.wave': 'audio/wav',
};
/** The bucket type to store a picked sound as, or null when it is not an MP3, M4A or WAV. */
export const cardAudioType = (type: string): string | null => AUDIO_ALIASES[type] ?? null;
/** Sounds are limited to 2 MB in the UI (Q5). */
export { MAX_SOUND_BYTES } from '@/lib/media';
export const AUDIO_ACCEPT = ['.mp3', '.m4a', '.wav', ...Object.keys(AUDIO_ALIASES)].join(',');

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** A13: which levels the active cards allow, e.g. "12 active cards: levels 12, 16, 20 and 24 are available; 30 needs 15." */
export function poolHealth(active: number): string {
  const ok = levelsAvailable(active);
  const yes = LEVELS.filter((l) => ok[l]).map(String);
  const no = LEVELS.filter((l) => !ok[l]).map((l) => `${l} needs ${pairsOf(l)}`);
  const head = `${active} active ${active === 1 ? 'card' : 'cards'}: `;
  const avail = yes.length === 0 ? 'no level is available yet' : `${yes.length === 1 ? 'level' : 'levels'} ${list(yes)} ${yes.length === 1 ? 'is' : 'are'} available`;
  return `${head}${avail}${no.length ? `; ${no.join(', ')}` : ''}.`;
}

const small = { ...ghostBtn, height: 34, padding: '0 12px', fontSize: 13 } as const;
const hint = { fontSize: 12, color: '#7A6458' } as const;

export const WEAK_GROUP_TEXT = 'Sort It needs at least 4 cards with different words in a group.';

/** One card of the pool: picture, word, pronunciation, group (A18), on/off and delete. Edits go up through `onEdit`. */
export function CardPanel({ c, n, duplicate, message, autoFocus, groups, weakGroup, onEdit, onChooseLibrary, onSvg, onPlay, onAskDelete, onVisibility }: {
  c: ECard; n: number; duplicate: boolean; message: string | null; autoFocus: boolean;
  groups: readonly EGroup[]; weakGroup: boolean;
  onEdit: (patch: Partial<ECard>) => void;
  /** A picture or sound already in the library: the bucket path, nothing uploaded (A24). */
  onChooseLibrary: (kind: 'image' | 'audio', path: string) => void;
  onSvg: (code: string) => void; onPlay: () => void;
  /** Absent in the Super Admin's Global tab: a global card is unpublished, not deleted. */
  onAskDelete?: () => void;
  /** The row was shared (it is now under review). */
  onVisibility?: (v: Visibility) => void;
}) {
  // Under review or global: read-only (V2, V3). Only the sharing row below stays usable.
  const locked = lockedOwn(c.visibility, c.superOwned);
  const [svg, setSvg] = useState('');
  const len = c.word.trim().length;
  const img = mediaUrl(c.image);
  const missing = [!len && 'a word', !c.image && 'a picture'].filter(Boolean).join(' and ');
  const groupValue = c.groupId && groups.some((g) => g.id === c.groupId) ? c.groupId : '';

  return (
    <article aria-label={`Card ${n}`} style={{ ...panel, padding: 16, gap: 10, opacity: c.active ? 1 : 0.75, border: isCardComplete(c) ? '1.5px solid transparent' : '1.5px dashed #E5C979' }}>
      <EditLock locked={locked}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#7A6458' }}>Card {n}</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          <input type="checkbox" role="switch" aria-label={`Card ${n} on`} checked={c.active} onChange={() => onEdit({ active: !c.active })} style={{ width: 18, height: 18, margin: 0, accentColor: '#3F6B48' }} />
          {c.active ? 'On' : 'Off'}
        </label>
      </div>

      <div style={{ height: 120, borderRadius: 14, background: '#FBF4E9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A8968A', overflow: 'hidden' }}>
        {img ? <Pic src={img} alt={`Card ${n} picture`} draggable={false} style={{ width: 104, height: 104, objectFit: 'contain' }} /> : <PicIcon size={32} />}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <LibraryButton kind="image" label={`card ${n} picture`} onChoose={(path) => onChooseLibrary('image', path)} />
        {c.image && <span style={{ ...hint, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{fileName(c.image)}</span>}
      </div>
      <details>
        <summary style={{ fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Or paste SVG code</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <textarea className={s.in} aria-label={`SVG code for card ${n}`} rows={3} value={svg} onChange={(e) => setSvg(e.target.value)} placeholder="<svg …>…</svg>"
            style={{ ...inputStyle, height: 'auto', padding: 8, fontSize: 12, fontFamily: 'monospace', resize: 'vertical' }} />
          <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Use SVG for card ${n}`} style={{ ...small, alignSelf: 'flex-start' }} disabled={!svg.trim()} onClick={() => { onSvg(svg); setSvg(''); }}>Use this drawing</button>
        </div>
      </details>

      <label htmlFor={`cw-${c.id}`} style={{ fontSize: 13, fontWeight: 700 }}>English word</label>
      <input id={`cw-${c.id}`} className={s.in} type="text" aria-label={`Word for card ${n}`} autoFocus={autoFocus} maxLength={WORD_MAX} value={c.word} placeholder="e.g. cat"
        onChange={(e) => onEdit({ word: e.target.value })} style={{ ...inputStyle, height: 40, width: '100%', boxSizing: 'border-box' }} />
      <span style={{ ...hint, alignSelf: 'flex-end', marginTop: -6 }}>{c.word.length}/{WORD_MAX}</span>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <LibraryButton kind="audio" label={`card ${n} sound`} onChoose={(path) => onChooseLibrary('audio', path)} />
        {c.audio && <button type="button" className={`${s.btn} ${s.ghost}`} style={small} onClick={() => onEdit({ audio: null })}>Remove sound</button>}
        <button type="button" className={`${s.btn} ${s.ghost}`} aria-label={`Play card ${n}`} style={small} disabled={!len && !c.audio} onClick={onPlay}>▶ Play</button>
      </div>
      <span style={hint}>{c.audio ? `Recording: ${fileName(c.audio)}` : 'No recording: the browser voice says the word.'}</span>

      <label htmlFor={`cg-${c.id}`} style={{ fontSize: 13, fontWeight: 700 }}>Group</label>
      <select id={`cg-${c.id}`} className={s.in} aria-label={`Group for card ${n}`} value={groupValue}
        onChange={(e) => onEdit({ groupId: e.target.value || null })}
        style={{ ...inputStyle, height: 40, width: '100%', boxSizing: 'border-box', padding: '0 10px', fontSize: 15, cursor: 'pointer', ...selectArrowStyle }}>
        <option value="">No group</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
      {weakGroup && <span role="status" style={{ fontSize: 13, fontWeight: 700, color: '#7A5410' }}>{WEAK_GROUP_TEXT}</span>}

      {message && <span role="alert" style={{ fontSize: 13, fontWeight: 700, color: '#A8484F' }}>{message}</span>}
      {duplicate && <span role="status" style={{ fontSize: 13, fontWeight: 700, color: '#7A5410' }}>Another card has the same word.</span>}
      {missing && <span style={{ fontSize: 13, color: '#7A5410' }}>Needs {missing} before you can save.</span>}

      {onAskDelete && <button type="button" className={`${s.btn} ${s.danger}`} aria-label={`Delete card ${n}`} onClick={onAskDelete} style={{ ...dangerBtn, height: 36, alignSelf: 'flex-start' }}>Delete</button>}
      </EditLock>
      {!c.isNew && c.visibility && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start', borderTop: '1px solid #F1E7DA', paddingTop: 10 }}>
          <VisibilityBadge visibility={c.visibility} copied={c.copied} />
          <ShareToggle table="memory_cards" id={c.id} visibility={c.visibility} superOwned={c.superOwned} onChanged={onVisibility} />
        </div>
      )}
    </article>
  );
}
