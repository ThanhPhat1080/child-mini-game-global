'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getMyProfile, type Role } from '@/lib/auth/roles';
import { pendingMessageCount, usePendingCounts } from '@/lib/superAdmin';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { RedDot } from '@/components/admin/RedDot';
import styles from '@/app/admin/admin.module.css';
import ui from '@/components/admin/admin-ui.module.css';

const icon = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };

/** Below this width the menu collapses to an icon rail by itself; it follows the window when resized. */
const SMALL = '(max-width: 1024px)';

type Item = { href: string; text: string; glyph: ReactNode };

/** Parent (PR12): the own profile and the children on it, and the feedback Inbox (spec 2026-11-07). */
const PROFILE: Item = { href: '/admin/profile', text: 'Profile', glyph: <g><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-4 4-6.5 8-6.5s7.2 2.5 8 6.5" /></g> };
const INBOX: Item = { href: '/admin/inbox', text: 'Inbox', glyph: <g><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z" /></g> };
/** Super Admin: Children first, with a baby's face (big head, small body, one curl of hair). */
const SUPER: Item[] = [
  { href: '/admin/all-children', text: 'Children', glyph: <g><circle cx="12" cy="11" r="7" /><path d="M10.5 4.4c.4-1.2 1.3-1.8 2.5-1.6" /><path d="M9.5 11h.01M14.5 11h.01" /><path d="M9.6 14.4c1.5 1.2 3.3 1.2 4.8 0" /><path d="M7.5 21.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5" /></g> },
  { href: '/admin/parents', text: 'Parents', glyph: <g><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /></g> },
  { href: '/admin/messages', text: 'Messages', glyph: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> },
];
const SHARED: Item[] = [
  { href: '/admin/media', text: 'Media', glyph: <g><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></g> },
  { href: '/admin/sets', text: 'Quiz sets', glyph: <g><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></g> },
  { href: '/admin/cards', text: 'Cards', glyph: <g><rect x="3" y="5" width="11" height="15" rx="2" /><path d="M17 4.5l3.2.9a2 2 0 0 1 1.4 2.4l-2.9 10.7" /></g> },
  { href: '/admin/spot', text: 'Spot', glyph: <g><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /><path d="M11 8v6M8 11h6" /></g> },
  { href: '/admin/find', text: 'Find', glyph: <g><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2.2" /><path d="M21 16l-5-5-8 8" /></g> },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  // Links that depend on the role appear once the profile is known; the shared ones show at once.
  const [role, setRole] = useState<Role | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  // The width animation turns on one frame after the first breakpoint check, so a phone does not
  // animate the rail from full width on page load (and the layout is final before the first paint of content).
  const [animated, setAnimated] = useState(false);
  // Tooltip for a collapsed rail: fixed-positioned so the nav's own scrolling never clips it.
  const [tip, setTip] = useState<{ text: string; top: number } | null>(null);
  // Unresolved parent messages for the red dot on Messages (Super Admin only, N18).
  const [pending, setPending] = useState(0);
  // Waiting shares per game for the red dots on the game icons (V3, V8). Counted on load, page change and each change.
  const counts = usePendingCounts(role, pathname);
  const waitingFor = (href: string): number => {
    if (href === '/admin/messages') return pending;
    if (role !== 'super_admin') return 0;
    const byHref: Record<string, number> = { '/admin/sets': counts.sets, '/admin/cards': counts.cards, '/admin/spot': counts.spot, '/admin/find': counts.find };
    return byHref[href] ?? 0;
  };

  useEffect(() => {
    let live = true;
    getMyProfile(createSupabaseBrowserClient()).then((p) => { if (live) setRole(p?.role ?? null); }, () => undefined);
    return () => { live = false; };
  }, []);

  // Counted on load and on every page change; a page that changes a message announces it, and the count is read again.
  useEffect(() => {
    if (role !== 'super_admin') return;
    let live = true;
    const refresh = () => {
      pendingMessageCount().then((n) => { if (live) setPending(n); }, () => { if (live) setPending(0); });
    };
    refresh();
    window.addEventListener('cp:messages-changed', refresh);
    return () => { live = false; window.removeEventListener('cp:messages-changed', refresh); };
  }, [role, pathname]);

  // Follow the window: collapse when it shrinks below SMALL, expand when it grows back.
  // Crossing the breakpoint overrides an earlier manual toggle; the toggle wins until the next crossing.
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(SMALL);
    setCollapsed(mq.matches);
    const frame = requestAnimationFrame(() => setAnimated(true));
    const onChange = (e: MediaQueryListEvent) => setCollapsed(e.matches);
    mq.addEventListener('change', onChange);
    return () => { cancelAnimationFrame(frame); mq.removeEventListener('change', onChange); };
  }, []);

  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.push('/admin/sign-in');
    router.refresh();
  }

  const showTip = useCallback((text: string, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setTip({ text, top: r.top + r.height / 2 });
  }, []);
  const hideTip = useCallback(() => setTip(null), []);
  const tipProps = (text: string) => collapsed
    ? { onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTip(text, e.currentTarget), onFocus: (e: React.FocusEvent<HTMLElement>) => showTip(text, e.currentTarget), onMouseLeave: hideTip, onBlur: hideTip }
    : {};

  const cls = (active: boolean, extra = '') => `${styles.navLink} ${active ? styles.navActive : ''} ${extra}`;
  // The label stays in the DOM when collapsed (clipped by the rail), so each link keeps its accessible name.
  const link = ({ href, text, glyph }: Item) => {
    const active = pathname.startsWith(href);
    // The dot sits on the icon, so it shows on the collapsed rail too. The name says the count (N18, V3).
    const waiting = waitingFor(href);
    const alert = waiting > 0;
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={alert ? `${text}, ${waiting} pending` : undefined}
        className={cls(active)}
        {...tipProps(text)}
      >
        <span className={ui.iconTag}>
          <svg {...icon}>{glyph}</svg>
          {alert && <RedDot />}
        </span>
        <span className={styles.navLabel}>{text}</span>
      </Link>
    );
  };
  const toggleText = collapsed ? 'Expand menu' : 'Collapse menu';

  return (
    <nav className={`${styles.nav} ${collapsed ? styles.navCollapsed : ''} ${animated ? styles.navAnimated : ''}`} aria-label="Admin menu" onScroll={hideTip}>
      <div className={styles.navBrand}>
        <span className={styles.crownDot}>
          <svg aria-hidden="true" width="24" height="18" viewBox="0 0 60 42" fill="#F6E2A6" stroke="#B08A48" strokeWidth="3" strokeLinejoin="round">
            <path d="M4 38 L8 10 L20 24 L30 4 L40 24 L52 10 L56 38 Z" />
          </svg>
        </span>
        <span className={`${styles.brand} ${styles.navBrandText}`}>{role === 'super_admin' ? 'Super Admin' : 'Parent Admin'}</span>
        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={!collapsed}
          aria-label={toggleText}
          onClick={() => { setCollapsed((c) => !c); hideTip(); }}
          {...tipProps(toggleText)}
        >
          <svg aria-hidden="true" className={styles.navToggleIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
      </div>
      {role === 'parent' && (
        <>
          {link(PROFILE)}
          {link(INBOX)}
        </>
      )}
      {role === 'super_admin' && (
        <>
          {link(PROFILE)}
          {SUPER.map(link)}
          <div className={styles.divider} />
        </>
      )}
      {link(SHARED[0])}
      <div className={styles.divider} />
      <div role="group" aria-labelledby="admin-nav-games" className={styles.navGroup}>
        <span id="admin-nav-games" className={styles.navGroupTitle}>Game settings</span>
        {SHARED.slice(1).map(link)}
      </div>
      <div className={styles.divider} />
      <Link href="/" className={cls(false, styles.navGreen)} {...tipProps('Open child app')}>
        <svg {...icon}><path d="M14 3h7v7" /><path d="M10 14L21 3" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></svg>
        <span className={styles.navLabel}>Open child app</span>
      </Link>
      <button type="button" className={cls(false, styles.navRose)} onClick={signOut} {...tipProps('Sign out')}>
        <svg {...icon}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></svg>
        <span className={styles.navLabel}>Sign out</span>
      </button>
      {tip && <div className={styles.navTip} role="presentation" style={{ top: tip.top }}>{tip.text}</div>}
    </nav>
  );
}
