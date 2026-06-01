'use client';

import React, { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [lastAuthError, setLastAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Check if next-auth passed an error (like OAuthAccountNotLinked or AccessDenied)
  const authError = searchParams.get('error');
  if (authError !== lastAuthError) {
    setLastAuthError(authError);
    if (authError === 'AccessDenied') {
      setError('Access denied. Your account may be inactive, or not authorized.');
    } else if (authError === 'CredentialsSignin') {
      setError('Invalid email or password. Please try again.');
    } else if (authError) {
      setError('An authentication error occurred. Please try again.');
    }
  }

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Invalid email or password. Please try again.');
      } else {
        router.push('/compose');
        router.refresh();
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError(null);
    signIn('google', { callbackUrl: '/compose' });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4f0]">
      <div className="w-[360px] rounded-lg border border-[#ddd] bg-white p-9">
        <div className="mb-1 font-[var(--font-ibm-plex-mono)] text-[15px]">M37Labs</div>
        <div className="mb-7 text-[11px] text-[#999]">Email Portal · Internal Use Only</div>

        {error && (
          <div className="mb-3.5 flex items-start gap-2 rounded px-3 py-2 text-[12px] border border-[#f5c6c2] bg-[#fdecea] text-[#7f1f18]" style={{ display: 'flex' }}>
            <AlertCircle
              size={14}
              strokeWidth={2}
              style={{ flexShrink: 0, marginTop: '1px' }}
            />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleCredentialsSubmit}>
          <div className="mb-4 [&_label]:mb-[5px] [&_label]:block [&_label]:text-[11px] [&_label]:font-[500] [&_label]:uppercase [&_label]:tracking-[.06em] [&_label]:text-[#555] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#ddd] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-2.5 [&_input:not([type=checkbox])]:py-[7px] [&_input:not([type=checkbox])]:text-[12.5px] [&_input:not([type=checkbox])]:text-[#111] [&_input:not([type=checkbox])]:outline-none [&_input:not([type=checkbox])]:transition-colors placeholder:[&_input:not([type=checkbox])]:text-[#999] focus:[&_input:not([type=checkbox])]:border-[#1a1a1a] [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-[#ddd] [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-[7px] [&_select]:text-[12.5px] [&_select]:text-[#111] [&_select]:outline-none focus:[&_select]:border-[#1a1a1a] [&_textarea]:w-full [&_textarea]:min-h-20 [&_textarea]:resize-y [&_textarea]:rounded [&_textarea]:border [&_textarea]:border-[#ddd] [&_textarea]:bg-white [&_textarea]:px-2.5 [&_textarea]:py-[7px] [&_textarea]:text-[12.5px] [&_textarea]:text-[#111] [&_textarea]:outline-none placeholder:[&_textarea]:text-[#999] focus:[&_textarea]:border-[#1a1a1a]">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="you@m37labs.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="mb-4 [&_label]:mb-[5px] [&_label]:block [&_label]:text-[11px] [&_label]:font-[500] [&_label]:uppercase [&_label]:tracking-[.06em] [&_label]:text-[#555] [&_input:not([type=checkbox])]:w-full [&_input:not([type=checkbox])]:rounded [&_input:not([type=checkbox])]:border [&_input:not([type=checkbox])]:border-[#ddd] [&_input:not([type=checkbox])]:bg-white [&_input:not([type=checkbox])]:px-2.5 [&_input:not([type=checkbox])]:py-[7px] [&_input:not([type=checkbox])]:text-[12.5px] [&_input:not([type=checkbox])]:text-[#111] [&_input:not([type=checkbox])]:outline-none [&_input:not([type=checkbox])]:transition-colors placeholder:[&_input:not([type=checkbox])]:text-[#999] focus:[&_input:not([type=checkbox])]:border-[#1a1a1a] [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-[#ddd] [&_select]:bg-white [&_select]:px-2.5 [&_select]:py-[7px] [&_select]:text-[12.5px] [&_select]:text-[#111] [&_select]:outline-none focus:[&_select]:border-[#1a1a1a] [&_textarea]:w-full [&_textarea]:min-h-20 [&_textarea]:resize-y [&_textarea]:rounded [&_textarea]:border [&_textarea]:border-[#ddd] [&_textarea]:bg-white [&_textarea]:px-2.5 [&_textarea]:py-[7px] [&_textarea]:text-[12.5px] [&_textarea]:text-[#111] [&_textarea]:outline-none placeholder:[&_textarea]:text-[#999] focus:[&_textarea]:border-[#1a1a1a]">
            <label htmlFor="password">Password</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wider text-[#999] hover:text-[#111] cursor-pointer select-none"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          <div className="flex items-center" style={{ justifyContent: 'space-between', marginBottom: '18px' }}>
            <Link href="/forgot-password" className="cursor-pointer text-[11.5px] text-[#999] underline hover:text-[#111]">
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-transparent px-3.5 py-1.5 text-[12px] font-[500] leading-[1.4] no-underline transition-all disabled:cursor-not-allowed disabled:opacity-40 border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-[#333]"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="my-[18px] flex items-center gap-2.5 before:h-px before:flex-1 before:bg-[#ddd] before:content-[''] after:h-px after:flex-1 after:bg-[#ddd] after:content-[''] [&_span]:text-[11px] [&_span]:text-[#999]">
          <span>or</span>
        </div>

        <button
          type="button"
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded border border-[#ddd] bg-white px-3.5 py-2 text-[12.5px] text-[#111] hover:bg-[#f5f4f0]"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
