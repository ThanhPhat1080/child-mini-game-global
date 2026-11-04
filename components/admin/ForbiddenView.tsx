import Link from 'next/link';
import { AdminSignOutButton } from '@/components/AdminSignOutButton';
import styles from '@/app/admin/admin.module.css';

/** "You don't have permission" screen (U11): a child on /admin, or a parent on a Super Admin page. */
export function ForbiddenView({ text = 'This account cannot open the parent admin.', home }: { text?: string; home?: string }) {
  return (
    <div className={`${styles.page} ${styles.signWrap}`}>
      <div className={styles.signCol}>
        <div className={styles.card}>
          <h1>You don&apos;t have permission</h1>
          <p className={styles.sub}>{text}</p>
          {home && <Link href={home} className={styles.link}>Go back</Link>}
          <AdminSignOutButton />
        </div>
      </div>
    </div>
  );
}
