'use client';

/** Play / pause icon: the same design as the Settings sound rows (white on rose). */
export function PlayIcon({ playing, size = 18 }: { playing: boolean; size?: number }) {
  return playing ? (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
  ) : (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="#FFFFFF"><path d="M8 5.5v13l10.5-6.5z" /></svg>
  );
}

/** Round play / pause button. `label` is the accessible name, e.g. "Play cat.mp3". */
export function PlayButton({ playing, label, onClick, size = 44, disabled = false }: {
  playing: boolean; label: string; onClick: () => void; size?: number; disabled?: boolean;
}) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
      style={{ width: size, height: size, flex: 'none', borderRadius: size / 2, border: 'none', background: '#EBB7BC', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <PlayIcon playing={playing} size={size >= 40 ? 18 : 14} />
    </button>
  );
}
