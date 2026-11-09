import type { ReactNode } from 'react';
import { AdminNav } from '@/components/AdminNav';
import type { Role } from '@/lib/auth/roles';
import styles from '@/app/admin/admin.module.css';

/** Menu + page frame shared by the (panel) and (super) layouts. The role is known on the server, so the menu is complete on the first paint. */
export function AdminShell({ role, children }: { role: Role | null; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AdminNav initialRole={role} />
      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
