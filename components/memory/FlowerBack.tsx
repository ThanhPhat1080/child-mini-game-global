/** Card back (M2): light pink with one small white flower, identical on every tile. */
export function FlowerBack() {
  return (
    <svg aria-hidden="true" width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block' }}>
      <rect x="0" y="0" width="100" height="100" fill="#F8DCDF" />
      <g transform="translate(50 50)">
        {[0, 72, 144, 216, 288].map((a) => (
          <ellipse key={a} cx="0" cy="-8" rx="5" ry="8" fill="#fff" transform={`rotate(${a})`} />
        ))}
        <circle r="4.5" fill="#EED79A" />
      </g>
    </svg>
  );
}
