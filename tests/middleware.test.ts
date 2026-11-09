// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { fakeFrom } from './support/fakeSupabase';

type Who = 'signedOut' | 'parent' | 'bannedParent' | 'superAdmin' | 'noProfile';

const h = vi.hoisted(() => ({
  who: 'signedOut' as string,
  setAll: null as null | ((c: { name: string; value: string; options: object }[]) => void),
  refreshCookie: false,
  childParent: null as string | null,
  childIds: ['11111111-1111-4111-8111-111111111111'] as string[],
}));

const profiles: Record<string, object> = {
  parent: { user_id: 'p1', role: 'parent', banned: false },
  bannedParent: { user_id: 'p2', role: 'parent', banned: true },
  superAdmin: { user_id: 's1', role: 'super_admin', banned: false },
};

vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: { cookies: { setAll: typeof h.setAll } }) => {
    h.setAll = opts.cookies.setAll;
    const { from } = fakeFrom((q) => {
      if (q.table === 'children') {
        const id = q.filters.find(([c]) => c === 'id')?.[1] as string;
        const parent = q.filters.find(([c]) => c === 'parent_id')?.[1];
        return { data: h.childIds.includes(id) && (parent === undefined || parent === (h.childParent ?? (profiles[h.who] as { user_id?: string } | undefined)?.user_id)) ? { id } : null };
      }
      return { data: profiles[h.who] ?? null };
    });
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

const CHILD = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  h.who = 'signedOut';
  h.refreshCookie = false;
  h.childIds = [CHILD];
  h.childParent = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://sb.test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
});

async function visit(path: string, who: Who, cookie: string | null = `cp_child=${CHILD}`) {
  h.who = who;
  const headers = cookie ? { cookie } : undefined;
  const res = await middleware(new NextRequest(new URL(path, 'http://app.test'), { headers }));
  const loc = res.headers.get('location');
  return loc ? new URL(loc).pathname : 'next';
}

const NEXT = 'next';
const ADMIN_IN = '/admin/sign-in';
const PLAY_IN = '/play/sign-in';
const PICKER = '/play';

// path, signedOut, parent, bannedParent, superAdmin, noProfile
const table: [string, string, string, string, string, string][] = [
  ['/', PLAY_IN, NEXT, NEXT, NEXT, PLAY_IN],
  ['/games', PLAY_IN, NEXT, NEXT, NEXT, PLAY_IN],
  ['/games/quiz/abc', PLAY_IN, NEXT, NEXT, NEXT, PLAY_IN],
  ['/admin', ADMIN_IN, NEXT, '/admin/suspended', NEXT, ADMIN_IN],
  ['/admin/settings', ADMIN_IN, NEXT, '/admin/suspended', NEXT, ADMIN_IN],
  ['/admin/sets/1', ADMIN_IN, NEXT, '/admin/suspended', NEXT, ADMIN_IN],
];
const whos: Who[] = ['signedOut', 'parent', 'bannedParent', 'superAdmin', 'noProfile'];

describe('middleware route protection (U11, U12, U13)', () => {
  for (const [path, ...expected] of table) {
    whos.forEach((who, i) => {
      it(`${path} as ${who} -> ${expected[i]}`, async () => {
        expect(await visit(path, who)).toBe(expected[i]);
      });
    });
  }

  const open = ['/admin/sign-in', '/admin/forbidden', '/admin/suspended', '/sign-up'];
  for (const path of open) {
    it(`${path} is open for everyone`, async () => {
      for (const who of whos) expect(await visit(path, who)).toBe(NEXT);
    });
  }

  describe('active child cookie (K9)', () => {
    for (const path of ['/', '/games', '/games/quiz/abc']) {
      it(`${path}: a profile without the cookie goes to /play`, async () => {
        expect(await visit(path, 'parent', null)).toBe(PICKER);
      });
      it(`${path}: a cookie that is not a UUID goes to /play`, async () => {
        expect(await visit(path, 'parent', 'cp_child=nope')).toBe(PICKER);
      });
      it(`${path}: the cookie of a deleted child (no row) goes to /play`, async () => {
        h.childIds = [];
        expect(await visit(path, 'parent')).toBe(PICKER);
      });
      it(`${path}: a valid cookie passes`, async () => {
        expect(await visit(path, 'parent')).toBe(NEXT);
      });
      it(`${path}: signed out still goes to /play/sign-in, with or without the cookie`, async () => {
        expect(await visit(path, 'signedOut', null)).toBe(PLAY_IN);
        expect(await visit(path, 'signedOut')).toBe(PLAY_IN);
      });
    }

    it("the cookie of another parent's child goes to /play", async () => {
      h.childParent = 'someone-else';
      expect(await visit('/games', 'parent')).toBe(PICKER);
    });

    it('?preview=1 with a profile passes without the cookie', async () => {
      expect(await visit('/games/quiz/x?preview=1', 'parent', null)).toBe(NEXT);
      expect(await visit('/games/quiz/x', 'parent', null)).toBe(PICKER);
    });

    it('?preview=1 with no profile still goes to /play/sign-in', async () => {
      expect(await visit('/games/quiz/x?preview=1', 'signedOut', null)).toBe(PLAY_IN);
      expect(await visit('/games/quiz/x?preview=1', 'noProfile', null)).toBe(PLAY_IN);
    });

    it('/play is never redirected without a visitor', async () => {
      for (const who of whos) {
        expect(await visit('/play', who, null)).toBe(NEXT);
        expect(await visit('/play', who, 'cp_child=nope')).toBe(NEXT);
      }
    });

    it('/admin does not look at the cookie', async () => {
      expect(await visit('/admin/settings', 'parent', null)).toBe(NEXT);
      expect(await visit('/admin', 'parent', 'cp_child=nope')).toBe(NEXT);
    });

    it('keeps refreshed session cookies on the /play redirect', async () => {
      h.refreshCookie = true;
      h.who = 'parent';
      const res = await middleware(new NextRequest(new URL('/games', 'http://app.test')));
      expect(new URL(res.headers.get('location')!).pathname).toBe(PICKER);
      expect(res.cookies.get('sb-token')?.value).toBe('fresh');
    });
  });

  it('keeps refreshed session cookies on a redirect', async () => {
    h.refreshCookie = true;
    h.who = 'signedOut';
    const res = await middleware(new NextRequest(new URL('/admin/settings', 'http://app.test')));
    expect(new URL(res.headers.get('location')!).pathname).toBe('/admin/sign-in');
    expect(res.cookies.get('sb-token')?.value).toBe('fresh');
  });

  it('matches the welcome page, the picker, the sign-in chooser, /games and /admin', () => {
    expect(config.matcher).toEqual(['/', '/play', '/play/sign-in', '/games/:path*', '/admin/:path*']);
  });
});

// Guest Play (GU9-GU11, GT2): a visitor is a cookie plus saved data in the browser; the cookie only opens pages.
describe('guest play routes (GU9-GU11)', () => {
  const VISITOR = 'cp_visitor=1';
  const cookie = (...parts: string[]) => parts.join('; ');

  it('a visitor with no profile opens Welcome and the games', async () => {
    for (const path of ['/', '/games', '/games/quiz/abc']) {
      expect(await visit(path, 'signedOut', VISITOR)).toBe(NEXT);
      expect(await visit(path, 'noProfile', VISITOR)).toBe(NEXT);
    }
  });

  it('a visitor on the picker goes to Welcome', async () => {
    expect(await visit('/play', 'signedOut', VISITOR)).toBe('/');
    expect(await visit('/play', 'noProfile', cookie(VISITOR, 'cp_child=nope'))).toBe('/');
  });

  it('a visitor at /admin lands on the admin sign-in, never admin', async () => {
    expect(await visit('/admin', 'signedOut', VISITOR)).toBe(ADMIN_IN);
    expect(await visit('/admin/settings', 'noProfile', VISITOR)).toBe(ADMIN_IN);
  });

  it('a visitor without the cookie still goes to the sign-in chooser', async () => {
    expect(await visit('/', 'signedOut', null)).toBe(PLAY_IN);
  });

  it('a profile beats the visitor cookie: no child sends the parent to the picker', async () => {
    expect(await visit('/', 'parent', VISITOR)).toBe(PICKER);
    expect(await visit('/games', 'parent', cookie(VISITOR))).toBe(PICKER);
  });

  it('a signed-in parent on the sign-in chooser goes to the picker; a signed-out visitor sees it', async () => {
    expect(await visit('/play/sign-in', 'parent', null)).toBe(PICKER);
    expect(await visit('/play/sign-in', 'superAdmin', null)).toBe(PICKER);
    expect(await visit('/play/sign-in', 'signedOut', null)).toBe(NEXT);
    expect(await visit('/play/sign-in', 'noProfile', VISITOR)).toBe(NEXT);
  });

  it('/play/guest is open for everyone', async () => {
    for (const who of whos) expect(await visit('/play/guest', who, null)).toBe(NEXT);
  });
});
