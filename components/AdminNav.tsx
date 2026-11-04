'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import styles from '@/app/admin/admin.module.css';

const icon = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push('/admin/sign-in');
    router.refresh();
  }

  const cls = (active: boolean, extra = '') => `${styles.navLink} ${active ? styles.navActive : ''} ${extra}`;

  return (
    <nav className={styles.nav}>
      <div className={styles.navBrand}>
        <span className={styles.crownDot} style={{ width: 40, height: 40 }}>
          <svg aria-hidden="true" width="24" height="18" viewBox="0 0 60 42" fill="#F6E2A6" stroke="#B08A48" strokeWidth="3" strokeLinejoin="round">
            <path d="M4 38 L8 10 L20 24 L30 4 L40 24 L52 10 L56 38 Z" />
          </svg>
        </span>
        <span className={styles.brand}>Parent Admin</span>
      </div>
      <Link href="/admin/settings" aria-current={pathname === '/admin/settings' ? 'page' : undefined} className={cls(pathname === '/admin/settings')}>
        <svg {...icon}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
        Settings
      </Link>
      <Link href="/admin/media" aria-current={pathname.startsWith('/admin/media') ? 'page' : undefined} className={cls(pathname.startsWith('/admin/media'))}>
        <svg {...icon}><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
        Media
      </Link>
      <Link href="/admin/sets" aria-current={pathname.startsWith('/admin/sets') ? 'page' : undefined} className={cls(pathname.startsWith('/admin/sets'))}>
        <svg {...icon}><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
        Quiz sets
      </Link>
      <Link href="/admin/cards" aria-current={pathname.startsWith('/admin/cards') ? 'page' : undefined} className={cls(pathname.startsWith('/admin/cards'))}>
        <svg {...icon}><rect x="3" y="5" width="11" height="15" rx="2" /><path d="M17 4.5l3.2.9a2 2 0 0 1 1.4 2.4l-2.9 10.7" /></svg>
        Cards
      </Link>
      <Link href="/admin/spot" aria-current={pathname.startsWith('/admin/spot') ? 'page' : undefined} className={cls(pathname.startsWith('/admin/spot'))}>
        <svg {...icon}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M11 8v6M8 11h6" /></svg>
        Spot
      </Link>
      <Link href="/admin/find" aria-current={pathname.startsWith('/admin/find') ? 'page' : undefined} className={cls(pathname.startsWith('/admin/find'))}>
        <svg {...icon}><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2.2" /><path d="M21 16l-5-5-8 8" /></svg>
        Find
      </Link>
      <div className={styles.divider} />
      <Link href="/" className={cls(false)}>
        <svg {...icon}><path d="M14 3h7v7" /><path d="M10 14L21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
        Open child app
      </Link>
      <button type="button" className={cls(false, styles.navMuted)} onClick={signOut}>
        <svg {...icon}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
        Sign out
      </button>
    </nav>
  );
}
