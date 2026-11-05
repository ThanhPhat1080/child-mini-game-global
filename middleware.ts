import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { adminAccess, getMyProfile } from '@/lib/auth/roles';
import { ACTIVE_CHILD_COOKIE } from '@/lib/childSession';

const ADMIN_SIGN_IN = '/admin/sign-in';
const PLAY_SIGN_IN = '/play/sign-in';
const PICKER = '/play';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pages anyone may open, signed in or not (no redirect loops). */
const OPEN = new Set(['/play', ADMIN_SIGN_IN, '/admin/forbidden', '/admin/suspended', PLAY_SIGN_IN, '/sign-up']);

const ADMIN_TARGET = { signin: ADMIN_SIGN_IN, forbidden: '/admin/forbidden', banned: '/admin/suspended' } as const;

/**
 * Role-aware route guard (U11, U12, U13, K9). Reads the caller's profile on every request, so a ban takes
 * effect immediately. `/` and `/games/*` need a signed-in profile and an active child (cookie that selects
 * one of the parent's own `children` rows through RLS); `/admin/*` follows `adminAccess`.
 * `/play` and `/play/sign-in` are not matched and stay open.
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
  const isAdminArea = path === '/admin' || path.startsWith('/admin/');

  let target: string | null;
  if (isAdminArea) {
    const access = adminAccess(profile);
    target = access === 'ok' ? null : ADMIN_TARGET[access];
  } else {
    target = !profile ? PLAY_SIGN_IN : (await hasActiveChild(request, supabase)) ? null : PICKER;
  }
  if (!target) return response;

  const url = request.nextUrl.clone();
  url.pathname = target;
  url.search = '';
  const redirect = NextResponse.redirect(url);
  // Keep any session cookies the auth refresh just set.
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

/** The `cp_child` cookie is a UUID and RLS lets this session select that child (a deleted child's id finds nothing). */
async function hasActiveChild(request: NextRequest, supabase: SupabaseClient): Promise<boolean> {
  const id = request.cookies.get(ACTIVE_CHILD_COOKIE)?.value;
  if (!id || !UUID.test(id)) return false;
  const { data, error } = await supabase.from('children').select('id').eq('id', id).maybeSingle();
  return !error && !!data;
}

export const config = {
  matcher: ['/', '/games/:path*', '/admin/:path*'],
};
