// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fakeFrom } from './support/fakeSupabase';

type Who = 'signedOut' | 'child' | 'parent' | 'bannedParent' | 'superAdmin' | 'noProfile';

const h = vi.hoisted(() => ({
  who: 'signedOut' as string,
  setAll: null as null | ((c: { name: string; value: string; options: object }[]) => void),
  refreshCookie: false,
}));

const profiles: Record<string, object> = {
  child: { user_id: 'c1', role: 'child', parent_id: 'p1', banned: false },
  parent: { user_id: 'p1', role: 'parent', parent_id: null, banned: false },
  bannedParent: { user_id: 'p2', role: 'parent', parent_id: null, banned: true },
  superAdmin: { user_id: 's1', role: 'super_admin', parent_id: null, banned: false },
};

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: typeof h.setAll } }) => {
    h.setAll = opts.cookies.setAll;
    const { from } = fakeFrom(() => ({ data: profiles[h.who] ?? null }));
    return {
      auth: {
        getUser: vi.fn(async () => {
          if (h.refreshCookie) h.setAll!([{ name: 'sb-token', value: 'fresh', options: { path: '/' } }]);
          return { data: { user: h.who === 'signedOut' ? null : { id: 'x' } }, error: null };
        }),
      },
      from,
    };
  },
}));

import { config, middleware } from '@/middleware';

beforeEach(() => {
  h.who = 'signedOut';
  h.refreshCookie = false;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://sb.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

async function visit(path: string, who: Who) {
  h.who = who;
  const res = await middleware(new NextRequest(new URL(path, 'http://app.test')));
  const loc = res.headers.get('location');
  return loc ? new URL(loc).pathname : 'next';
}

const NEXT = 'next';
const ADMIN_IN = '/admin/sign-in';
const PLAY_IN = '/play/sign-in';

// path, signedOut, child, parent, bannedParent, superAdmin, noProfile
const table: [string, string, string, string, string, string, string][] = [
  ['/', PLAY_IN, NEXT, NEXT, NEXT, NEXT, PLAY_IN],
  ['/games', PLAY_IN, NEXT, NEXT, NEXT, NEXT, PLAY_IN],
  ['/games/quiz/abc', PLAY_IN, NEXT, NEXT, NEXT, NEXT, PLAY_IN],
  ['/admin', ADMIN_IN, '/admin/forbidden', NEXT, '/admin/suspended', NEXT, ADMIN_IN],
  ['/admin/settings', ADMIN_IN, '/admin/forbidden', NEXT, '/admin/suspended', NEXT, ADMIN_IN],
  ['/admin/sets/1', ADMIN_IN, '/admin/forbidden', NEXT, '/admin/suspended', NEXT, ADMIN_IN],
];
const whos: Who[] = ['signedOut', 'child', 'parent', 'bannedParent', 'superAdmin', 'noProfile'];

describe('middleware route protection (U11, U12, U13)', () => {
  for (const [path, ...expected] of table) {
    whos.forEach((who, i) => {
      it(`${path} as ${who} -> ${expected[i]}`, async () => {
        expect(await visit(path, who)).toBe(expected[i]);
      });
    });
  }

  const open = ['/admin/sign-in', '/admin/forbidden', '/admin/suspended', '/play/sign-in', '/sign-up'];
  for (const path of open) {
    it(`${path} is open for everyone`, async () => {
      for (const who of whos) expect(await visit(path, who)).toBe(NEXT);
    });
  }

  it('keeps refreshed session cookies on a redirect', async () => {
    h.refreshCookie = true;
    h.who = 'child';
    const res = await middleware(new NextRequest(new URL('/admin/settings', 'http://app.test')));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/admin/forbidden');
    expect(res.cookies.get('sb-token')?.value).toBe('fresh');
  });

  it('matches the welcome page, /games and /admin', () => {
    expect(config.matcher).toEqual(['/', '/games/:path*', '/admin/:path*']);
  });
});
