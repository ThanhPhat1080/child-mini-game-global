/** The robot opponent's face: a drawn robot head with an antenna, two eyes and a smile. Text-free: the child cannot read. */
export function RobotIcon({ size = 120, body = '#A9C6DE', ink = '#5A4038' }: { size?: number; body?: string; ink?: string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ display: 'block', flex: 'none' }}>
      <line x1="50" y1="14" x2="50" y2="26" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="11" r="6" fill="#E59AA1" />
      <rect x="14" y="40" width="9" height="20" rx="4" fill={ink} />
      <rect x="77" y="40" width="9" height="20" rx="4" fill={ink} />
      <rect x="22" y="26" width="56" height="54" rx="14" fill={body} stroke={ink} strokeWidth="4" />
      <circle cx="38" cy="48" r="8" fill="#fff" stroke={ink} strokeWidth="3" />
      <circle cx="62" cy="48" r="8" fill="#fff" stroke={ink} strokeWidth="3" />
      <circle cx="39" cy="49" r="3.5" fill={ink} />
      <circle cx="63" cy="49" r="3.5" fill={ink} />
      <path d="M38 65 Q50 74 62 65" stroke={ink} strokeWidth="4" strokeLinecap="round" fill="none" />
    </svg>
  );
}
