import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { adminAccess, getMyProfile } from '@/lib/auth/roles';

const ADMIN_SIGN_IN = '/admin/sign-in';
const PLAY_SIGN_IN = '/play/sign-in';

/** Pages anyone may open, signed in or not (no redirect loops). */
const OPEN = new Set([ADMIN_SIGN_IN, '/admin/forbidden', '/admin/suspended', PLAY_SIGN_IN, '/sign-up']);

const ADMIN_TARGET = { signin: ADMIN_SIGN_IN, forbidden: '/admin/forbidden', banned: '/admin/suspended' } as const;

/**
 * Role-aware route guard (U11, U12, U13). Reads the caller's profile on every request, so a ban takes
 * effect immediately. `/` and `/games/*` need any signed-in profile; `/admin/*` follows `adminAccess`.
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
    target = profile ? null : PLAY_SIGN_IN;
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

export const config = {
  matcher: ['/', '/games/:path*', '/admin/:path*'],
};
