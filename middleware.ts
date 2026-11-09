import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { adminAccess, getMyProfile } from '@/lib/auth/roles';
import { ACTIVE_CHILD_COOKIE, GUEST_COOKIE } from '@/lib/childSession';
import { VISITOR_COOKIE } from '@/lib/visitor';

const ADMIN_SIGN_IN = '/admin/sign-in';
const PLAY_SIGN_IN = '/play/sign-in';
const PICKER = '/play';
const GUEST_SETUP = '/play/guest';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pages anyone may open, signed in or not (no redirect loops). */
// /play and /play/sign-in are not here: they redirect a visitor or a signed-in parent (GU9, GU10).
const OPEN = new Set([ADMIN_SIGN_IN, '/admin/forbidden', '/admin/suspended', '/sign-up']);

const ADMIN_TARGET = { signin: ADMIN_SIGN_IN, forbidden: '/admin/forbidden', banned: '/admin/suspended' } as const;

/**
 * Role-aware route guard (U11, U12, U13, K9). Reads the caller's profile on every request, so a ban takes
 * effect immediately. `/` and `/games/*` need a signed-in profile and an active child (cookie that selects
 * one of the parent's own `children` rows through RLS) or the guest cookie (no child: global content only);
 * `/admin/*` follows `adminAccess`.
 * `/play/sign-in` sends a signed-in parent to `/play`; `/play/guest` is open to all; `/play` sends a visitor to `/` (GU9, GU10).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const path = request.nextUrl.pathname;
  if (OPEN.has(path)) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  ) as unknown as SupabaseClient;

  const profile = await getMyProfile(supabase);
  const visitor = request.cookies.get(VISITOR_COOKIE)?.value === '1';

  // The sign-in chooser: a signed-in parent never sees it (Q14, GU9). A visitor on the picker goes to Welcome (GU10).
  if (path === PLAY_SIGN_IN) return profile ? redirectTo(request, response, PICKER) : response;
  if (path === PICKER) return !profile && visitor ? redirectTo(request, response, '/') : response;
  // The guest setup is open to a signed-in parent too: with no child yet, the picker's Guest card leads here (Q14).
  if (path === GUEST_SETUP) return response;

  const isAdminArea = path === '/admin' || path.startsWith('/admin/');

  let target: string | null;
  if (isAdminArea) {
    const access = adminAccess(profile);
    target = access === 'ok' ? null : ADMIN_TARGET[access];
  } else if (!profile) {
    // A visitor (cookie, valid data checked by the page) may open Welcome and the games (GU10, GU11).
    target = visitor ? null : PLAY_SIGN_IN;
  } else {
    const guest = request.cookies.get(GUEST_COOKIE)?.value === '1';
    // A profile beats the visitor cookie: the visitor is ignored here (GU8).
    target = request.nextUrl.searchParams.get('preview') === '1' || guest || (await hasActiveChild(request, supabase, profile.user_id)) ? null : PICKER;
  }
  if (!target) return response;
  return redirectTo(request, response, target);
}

function redirectTo(request: NextRequest, response: NextResponse, target: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = '';
  const redirect = NextResponse.redirect(url);
  // Keep any session cookies the auth refresh just set.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

/** The `cp_child` cookie is a UUID naming one of this parent's own children (a deleted or foreign child's id finds nothing). */
async function hasActiveChild(request: NextRequest, supabase: SupabaseClient, parentId: string): Promise<boolean> {
  const id = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!id || !UUID.test(id)) return false;
  const { data, error } = await supabase.from('children').select('id').eq('id', id).eq('parent_id', parentId).maybeSingle();
  return !error && !!data;
}

export const config = {
  matcher: ['/', '/play', '/play/sign-in', '/play/guest', '/games/:path*', '/admin/:path*'],
};
