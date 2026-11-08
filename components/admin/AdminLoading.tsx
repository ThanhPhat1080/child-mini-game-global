import Image from 'next/image';
import s from './admin-ui.module.css';

/**
 * The wait on every admin screen: the bundled fish bobbing over soft water ripples (honors reduced motion).
 * No visible words; a screen reader still hears the label.
 */
export function AdminLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className={s.loadingBox}>
      <div className={s.loadingWater} aria-hidden="true">
        <span className={s.loadingRipple} /><span className={s.loadingRipple} /><span className={s.loadingRipple} />
        <Image className={s.loadingFish} src="/seed/fish.svg" alt="" width={60} height={60} unoptimized />
      </div>
      <span className={s.srOnly}>{label}</span>
    </div>
  );
}
