import { Pic } from '@/components/Pic';
import play from '../play/play.module.css';
import styles from './auth.module.css';

/** Shown for 2 s before a parent signs out of the play device (FP14): the princess and a bubble. */
export default function FarewellPopup() {
  return (
    <div className={play.overlay} role="status">
      <div className={styles.farewell}>
        <div className={styles.bubble}>See you later!</div>
        <Pic src="/images/princess.webp" alt="" width={360} height={455} className={styles.farewellPic} />
      </div>
    </div>
  );
}
