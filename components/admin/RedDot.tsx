import s from './admin-ui.module.css';

/**
 * A red dot for "something is waiting" (N12, N18). Place it inside a positioned element. The optional label is
 * read by screen readers only; leave it out where the element's own name already says it.
 */
export function RedDot({ label }: { label?: string }) {
  return (
    <>
      <span aria-hidden="true" className={s.redDot} />
      {label && <span className={s.srOnly}>{label}</span>}
    </>
  );
}
