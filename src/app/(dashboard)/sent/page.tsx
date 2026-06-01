'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { ChevronLeft, AlertCircle, Paperclip, Search, Loader2, Mail } from 'lucide-react';

interface ISentEmail {
  _id: string;
  to_addresses: string[];
  cc_addresses: string[];
  subject: string;
  body: string;
  sent_by: {
    _id: string;
    full_name: string;
    email: string;
  };
  gmail_message_id: string | null;
  status: 'SENT' | 'FAILED';
  sent_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  reply_to: string;
  attachment_ids: string[];
  createdAt: string;
}

export default function SentPage() {
  const { data: session } = useSession();
  const [emails, setEmails] = useState<ISentEmail[]>([]);
  const [search, setSearch] = useState('');
  const [viewingEmail, setViewingEmail] = useState<ISentEmail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSentEmails = async (query = '') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/emails/sent?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && Array.isArray(data.emails)) {
        setEmails(data.emails);
      }
    } catch (err) {
      console.error('Error fetching sent emails:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSentEmails(search);
  }, [search]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[date.getMonth()];
    const day = date.getDate();
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    return `${day} ${month} · ${hours}:${mins}`;
  };

  const formatLongDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()} at ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const isSpm = session?.user?.role === 'SENIOR_PRODUCT_MANAGER';

  if (viewingEmail) {
    return (
      <div id="sent-detail-screen" className="flex flex-col flex-1 text-slate-200">
        <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
          <span className="text-base font-semibold tracking-tight text-slate-100">Sent Emails</span>
          <span className="text-slate-500">/</span>
          <span className="text-sm text-slate-400 truncate max-w-[200px] md:max-w-md font-medium">{viewingEmail.subject}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded-md bg-slate-950/40 border border-slate-800 px-3 py-1 font-mono text-[10.5px] text-slate-400">
              ID: {viewingEmail.gmail_message_id || viewingEmail._id}
            </span>
          </div>
        </div>
        <div className="flex-1 p-6">
          <button
            className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100"
            onClick={() => setViewingEmail(null)}
          >
            <ChevronLeft size={14} strokeWidth={2.5} />
            Back to Sent Emails
          </button>
          
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-slate-100">{viewingEmail.subject}</h1>
              <div className="mt-2 text-xs text-slate-400">
                {viewingEmail.status === 'SENT' ? 'Sent' : 'Failed'} by <span className="font-semibold text-slate-300">{viewingEmail.sent_by?.full_name || 'System'}</span> · {formatLongDate(viewingEmail.sent_at || viewingEmail.failed_at || viewingEmail.createdAt)} · via <span className="font-mono text-slate-300">info@m37labs.com</span>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${
              viewingEmail.status === 'SENT'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${viewingEmail.status === 'SENT' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
              {viewingEmail.status === 'SENT' ? 'Sent' : 'Failed'}
            </span>
          </div>

          {viewingEmail.status === 'FAILED' && viewingEmail.failure_reason && (
            <div className="mb-6 flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-400">
              <AlertCircle size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">Delivery Failure</p>
                <p className="leading-relaxed">{viewingEmail.failure_reason}</p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
            <div className="border-b border-slate-800 bg-slate-900/60 px-6 py-4 space-y-2">
              <div className="flex gap-4 text-xs">
                <span className="w-20 shrink-0 font-semibold text-slate-400">From</span>
                <span className="font-mono text-slate-300">info@m37labs.com</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="w-20 shrink-0 font-semibold text-slate-400">Reply-To</span>
                <span className="font-mono text-slate-300">{viewingEmail.reply_to}</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span className="w-20 shrink-0 font-semibold text-slate-400">To</span>
                <span className="font-mono text-slate-300">{viewingEmail.to_addresses.join(', ')}</span>
              </div>
              {viewingEmail.cc_addresses && viewingEmail.cc_addresses.length > 0 && (
                <div className="flex gap-4 text-xs">
                  <span className="w-20 shrink-0 font-semibold text-slate-400">CC</span>
                  <span className="font-mono text-slate-300">{viewingEmail.cc_addresses.join(', ')}</span>
                </div>
              )}
              {viewingEmail.attachment_ids && viewingEmail.attachment_ids.length > 0 && (
                <div className="flex gap-4 text-xs">
                  <span className="w-20 shrink-0 font-semibold text-slate-400">Attachments</span>
                  <div className="flex flex-wrap gap-2">
                    {viewingEmail.attachment_ids.map((attId, idx) => (
                      <a
                        key={attId}
                        href={`/api/attachments/${attId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-all"
                      >
                        <Paperclip size={12} strokeWidth={2} />
                        Attachment {idx + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div
              className="bg-slate-950/60 p-6 text-sm leading-relaxed text-slate-200"
              dangerouslySetInnerHTML={{ __html: viewingEmail.body }}
              style={{ overflowWrap: 'break-word' }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="sent-screen" className="flex flex-col flex-1 text-slate-200">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
        <span className="text-base font-semibold tracking-tight text-slate-100">Sent Emails</span>
        <div className="ml-auto flex items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" strokeWidth={2} />
            <input
              type="text"
              placeholder="Search subject or recipient…"
              className="w-64 rounded-lg border border-slate-700/50 bg-slate-950/40 py-2 pl-9 pr-4 text-xs text-slate-200 placeholder-slate-500 transition-all focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="flex-1 p-6">
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Subject</th>
                  {isSpm && <th id="sent-by-col" className="px-4 py-3">Sent by</th>}
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={isSpm ? 6 : 5} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <span>Loading sent history...</span>
                      </div>
                    </td>
                  </tr>
                ) : emails.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 6 : 5} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="rounded-full bg-slate-900/60 p-4 border border-slate-800 text-slate-500">
                          <Mail size={32} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-300">No sent emails found</p>
                          <p className="text-xs text-slate-500">When you send emails, they will appear here.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  emails.map((email) => (
                    <tr key={email._id} className="transition-colors hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-[11.5px] text-slate-300" title={email.to_addresses.join(', ')}>
                        {email.to_addresses[0]}
                        {email.to_addresses.length > 1 && (
                          <span className="ml-1 text-[10px] text-indigo-400 font-sans font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            +{email.to_addresses.length - 1}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200 max-w-[300px] truncate" title={email.subject}>
                        {email.subject}
                      </td>
                      {isSpm && <td className="px-4 py-3 text-slate-300">{email.sent_by?.full_name || 'System'}</td>}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {formatDate(email.sent_at || email.failed_at || email.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          email.status === 'SENT'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${email.status === 'SENT' ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                          {email.status === 'SENT' ? 'Sent' : 'Failed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100"
                          onClick={() => setViewingEmail(email)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
