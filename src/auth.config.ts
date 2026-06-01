import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      
      // List of public paths that don't require authentication
      const isPublicPath = 
        nextUrl.pathname.startsWith('/login') ||
        nextUrl.pathname.startsWith('/forgot-password') ||
        nextUrl.pathname.startsWith('/reset-password') ||
        nextUrl.pathname.startsWith('/api/auth') ||
        nextUrl.pathname.startsWith('/api/cron'); // Process queue can be triggered by external cron

      const isOnDashboard = !isPublicPath;

      if (isOnDashboard) {
        if (isLoggedIn) {
          // If the user is active, they can view dashboard
          if (auth?.user?.status === 'INACTIVE') {
            return false;
          }
          return true;
        }
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && nextUrl.pathname.startsWith('/login')) {
        return Response.redirect(new URL('/compose', nextUrl));
      }
      
      return true;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.status = token.status as string;
      }
      // If user status is inactive, invalidate the session by returning an empty/null session
      if (token?.status === 'INACTIVE') {
        return {
          ...session,
          user: null as any,
          expires: new Date(0).toISOString(),
        };
      }
      return session;
    },
  },
  providers: [], // Added in auth.ts
} satisfies NextAuthConfig;
