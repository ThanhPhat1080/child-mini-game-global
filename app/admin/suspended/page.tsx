import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import styles from '../admin.module.css';

/**
 * Shown to a banned parent who opens /admin (U13). Placeholder: Task 14 adds the reason, date and the
 * Contact the Super Admin box (U15, U17).
 */
export default function SuspendedPage() {
  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.card}>
          <h1>Your account is suspended</h1>
          <AdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
