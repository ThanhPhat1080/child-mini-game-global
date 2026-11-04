'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Round back (or home) button; Esc / Back key also goes back (C8). */
export function BackButton({ href, label = 'Back', home = false }: { href: string; label?: string; home?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'BrowserBack') router.push(href);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [href, router]);
  return (
    <Link href={href} className="hm-tap" aria-label={label} style={{ width: 104, height: 104, borderRadius: 52, background: '#fff', boxShadow: '0 6px 0 #EADCC8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {home ? (
        <svg aria-hidden="true" width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
      ) : (
        <svg aria-hidden="true" width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#7A5C50" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      )}
    </Link>
  );
}
