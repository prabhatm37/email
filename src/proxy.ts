import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Enforce role-based access for SPM-only paths
  const isSpmRoute = 
    nextUrl.pathname.startsWith('/users') || 
    nextUrl.pathname.startsWith('/api/users');

  if (isSpmRoute) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL('/login', nextUrl));
    }
    if (role !== 'SENIOR_PRODUCT_MANAGER') {
      // Redirect PMs to compose page since they are unauthorized
      return NextResponse.redirect(new URL('/compose', nextUrl));
    }
  }

  // Handle default homepage route redirecting to compose page
  if (nextUrl.pathname === '/' && isLoggedIn) {
    return NextResponse.redirect(new URL('/compose', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth API routes)
     * - api/cron (background cron jobs)
     * - api/attachments/upload (multipart uploads are validated in the route)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - login (login page)
     * - forgot-password (forgot password page)
     * - reset-password (reset password page)
     */
    '/((?!api/auth|api/cron|api/attachments/upload|_next/static|_next/image|favicon.ico|login|forgot-password|reset-password).*)',
  ],
};
