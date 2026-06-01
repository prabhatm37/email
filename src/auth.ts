import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { authConfig } from './auth.config';
import connectDB from '@/lib/db/mongodb';
import User from '@/lib/models/User';
import { checkRateLimit } from '@/lib/rate-limit';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        await connectDB();
        const email = credentials?.email;
        const password = credentials?.password;
        
        if (!email || !password) return null;
        
        const normalizedEmail = String(email).toLowerCase().trim();
        const rateLimit = await checkRateLimit(`credentials:${normalizedEmail}`, 10, 15 * 60 * 1000);
        if (!rateLimit.allowed) return null;

        const user = await User.findOne({ email: normalizedEmail });
        if (!user || user.status === 'INACTIVE') return null;
        if (user.login_method === 'OAUTH') return null; // blocked from credentials login

        const passwordsMatch = await bcrypt.compare(String(password), user.password_hash || '');
        if (passwordsMatch) {
          return {
            id: user._id.toString(),
            name: user.full_name,
            email: user.email,
            role: user.role,
            status: user.status,
          };
        }
        return null;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        await connectDB();
        const dbUser = await User.findOne({ email: user.email?.toLowerCase() });
        if (!dbUser || dbUser.status === 'INACTIVE') {
          return false; // Reject sign in if they aren't in our DB or are inactive
        }
        if (dbUser.login_method === 'PASSWORD') {
          return false; // Reject OAuth if they are restricted to Password login
        }
        
        // Populate next-auth user object with DB role/status/id
        user.role = dbUser.role;
        user.id = dbUser._id.toString();
        user.status = dbUser.status;
        
        // Log last login
        dbUser.last_login_at = new Date();
        await dbUser.save();
      } else if (account?.provider === 'credentials' && user) {
        // Log last login for credentials
        await connectDB();
        await User.findByIdAndUpdate(user.id, { last_login_at: new Date() });
      }
      return true;
    },
    async jwt({ token, user }) {
      await connectDB();
      if (user) {
        // Find user in DB by email to populate role and status correctly (e.g. for OAuth logins)
        const dbUser = await User.findOne({ email: user.email?.toLowerCase() });
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.status = dbUser.status;
        } else {
          token.id = user.id;
          token.role = user.role;
          token.status = user.status;
        }
      } else if (token.id) {
        // Fetch user from DB to verify they are still active and get latest role
        let dbUser = await User.findById(token.id);
        
        // If not found by ID (e.g. if the browser still holds an old session cookie with a Google account ID),
        // look up the user by email to automatically self-heal and migrate the session token.
        if (!dbUser && token.email) {
          dbUser = await User.findOne({ email: token.email.toLowerCase() });
          if (dbUser) {
            token.id = dbUser._id.toString();
          }
        }

        if (!dbUser || dbUser.status === 'INACTIVE') {
          token.role = undefined;
          token.status = 'INACTIVE';
        } else {
          token.role = dbUser.role;
          token.status = dbUser.status;
        }
      }
      return token;
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
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
});
