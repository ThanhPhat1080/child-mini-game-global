import styles from './Confetti.module.css';

const PAL = ['#EBB7BC', '#A9C6DE', '#EED79A', '#9CC3A4', '#F5C9A8', '#C9B6DC'];

/** Soft confetti burst from (originX, originY) on the 1920x1080 stage (ADR-021/026). */
export function Confetti({ count = 56, delayStep = 0.12 }: { count?: number; delayStep?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const w = i % 4 === 0 ? 10 : 16 + (i % 3) * 6;
        const h = i % 4 === 0 ? 34 : 14 + (i % 2) * 8;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`${styles.piece} ${styles[`b${i % 14}`]}`}
            style={{
              width: w,
              height: h,
              borderRadius: i % 3 === 1 ? '50%' : 4,
              background: PAL[i % 6],
              animationDelay: `${(Math.floor(i / 14) * delayStep).toFixed(2)}s`,
              animationDuration: `${(4.2 + (i % 5) * 0.18).toFixed(2)}s`,
            }}
          />
        );
      })}
    </>
  );
}
