'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Email is required.');
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to request password reset. Please try again.');
      } else {
        setMessage(data.message || 'If a matching active user is found, a password reset link has been sent.');
        setEmail('');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f4f0]">
      <div className="w-[360px] rounded-lg border border-[#ddd] bg-white p-9">
        <div className="mb-1 font-[var(--font-ibm-plex-mono)] text-[15px] font-[500]">Forgot Password</div>
        <div className="mb-7 text-[11px] text-[#999]" style={{ marginBottom: '22px' }}>
          Enter your email and we&apos;ll send a reset link.
        </div>

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

        {message && (
          <div className="mb-3.5 flex items-start gap-2 rounded px-3 py-2 text-[12px] border border-[#b2dfcc] bg-[#eaf7f0] text-[#1a5c35]" style={{ display: 'flex' }}>
            <CheckCircle
              size={14}
              strokeWidth={2}
              style={{ flexShrink: 0, marginTop: '1px' }}
            />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
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
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded border border-transparent px-3.5 py-1.5 text-[12px] font-[500] leading-[1.4] no-underline transition-all disabled:cursor-not-allowed disabled:opacity-40 border-[#1a1a1a] bg-[#1a1a1a] text-white hover:bg-[#333]"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={loading}
          >
            {loading ? 'Sending link...' : 'Send Reset Link'}
          </button>
        </form>

        <div style={{ marginTop: '14px', textAlign: 'center' }}>
          <Link href="/login" className="cursor-pointer text-[11.5px] text-[#999] underline hover:text-[#111]">
            ← Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
