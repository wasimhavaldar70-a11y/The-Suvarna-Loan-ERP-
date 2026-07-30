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

  let user: any = null;
  let userRole: string | undefined = undefined;

  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      user = data.user;
      userRole = user.user_metadata?.role;
    }
  } catch (err) {
    console.warn('Middleware auth.getUser warning:', err);
  }

  // Fallback: Support suvarna_session cookie
  if (!user) {
    const suvarnaCookie = request.cookies.get('suvarna_session')?.value;
    if (suvarnaCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(suvarnaCookie));
        if (parsed?.user?.id) {
          user = parsed.user;
          userRole = parsed.user.role;
        }
      } catch (err) {
        console.warn('Middleware suvarna_session cookie parse warning:', err);
      }
    }
  }

  // Edge Route Guard: Protect /dashboard and /admin routes
  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Role-based route enforcement (prevents cross-role access)
  if (pathname.startsWith('/admin') && userRole !== 'Super Admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/admin') && userRole === 'Super Admin') {
    return NextResponse.redirect(new URL('/admin/dashboard', request.url));
  }

  return response;
}
