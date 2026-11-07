import styles from './BounceText.module.css';

/**
 * Text whose letters drop in one after another and bounce. Screen readers get the plain text; the letters are decorative.
 * `delay` is when the first letter starts, `step` the gap between letters (seconds). Motion stops under prefers-reduced-motion.
 */
export function BounceText({ text, delay = 0, step = 0.09 }: { text: string; delay?: number; step?: number }) {
  return (
    <>
      <span className={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {[...text].map((ch, i) => (
          <span key={i} className={styles.letter} style={{ animationDelay: `${delay + i * step}s` }}>{ch === ' ' ? ' ' : ch}</span>
        ))}
      </span>
    </>
  );
}
