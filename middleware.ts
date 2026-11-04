import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const SIGN_IN = '/admin/sign-in';

/** Guards /admin/* (A1). Sign-in itself is open; everything else needs an admin session. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  if (request.nextUrl.pathname === SIGN_IN) return response;

  const { data: userData } = await supabase.auth.getUser();
  const { data: isAdmin } = userData.user ? await supabase.rpc('is_admin') : { data: false };

  if (!isAdmin) {
    const url = request.nextUrl.clone();
    url.pathname = SIGN_IN;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
