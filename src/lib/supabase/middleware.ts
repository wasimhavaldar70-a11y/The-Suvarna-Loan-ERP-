// ========================================================
// Supabase Middleware Session Refresh & Route Guard
// Location: src/lib/supabase/middleware.ts
// ========================================================

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const pathname = request.nextUrl.pathname;
  const isProtectedRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/admin');

  // Fast path: Unprotected routes do not require synchronous Supabase Auth network verification
  if (!isProtectedRoute) {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    return response;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // Edge Route Guard: Protect /dashboard and /admin routes
  // 1. Unauthenticated users cannot access protected routes
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Role-based route enforcement (prevents cross-role access)
  const userRole = user.user_metadata?.role;

  // Shop Owners/Staff CANNOT access /admin/* routes
  if (pathname.startsWith('/admin') && userRole !== 'Super Admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Super Admins accessing /dashboard (not /admin/dashboard) get redirected
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/admin') && userRole === 'Super Admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return response;
}
