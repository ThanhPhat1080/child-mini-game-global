import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import styles from '../admin.module.css';

/** Shown to a signed-in child who opens /admin (U11). Open in the middleware, so it never redirects. */
export default function ForbiddenPage() {
  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.card}>
          <h1>You don&apos;t have permission</h1>
          <p className={styles.sub}>This account cannot open the parent admin.</p>
          <AdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
