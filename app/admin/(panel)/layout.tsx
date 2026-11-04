import type { ReactNode } from 'react';
import { AdminNav } from '@/components/AdminNav';
import styles from '../admin.module.css';

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AdminNav />
      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
