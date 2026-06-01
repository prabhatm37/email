'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Loader2, Clock } from 'lucide-react';

interface IQueueItem {
  _id: string;
  to_addresses: string[];
  subject: string;
  created_by: {
    _id: string;
    full_name: string;
    email: string;
  };
  createdAt: string;
  status: 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED';
  failure_reason: string | null;
}

type TabType = 'ALL' | 'QUEUED' | 'PROCESSING' | 'FAILED' | 'SENT';

export default function QueuePage() {
  const { data: session } = useSession();
  const [queue, setQueue] = useState<IQueueItem[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('ALL');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchQueue = async (status: TabType, nextPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '20',
      });
      if (status !== 'ALL') {
        params.set('status', status.toLowerCase());
      }
      const url = `/api/queue?${params.toString()}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && Array.isArray(data.items)) {
        setQueue(data.items);
        setPage(data.pagination?.page || nextPage);
        setPages(data.pagination?.pages || 1);
      }
    } catch (err) {
      console.error('Error fetching queue:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll queue every 10 seconds for real-time update
  useEffect(() => {
    fetchQueue(activeTab, page);

    const interval = setInterval(() => {
      fetchQueue(activeTab, page);
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, page]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${date.getDate()} ${months[date.getMonth()]} · ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes()
    ).padStart(2, '0')}`;
  };

  const getStatusBadge = (status: IQueueItem['status']) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"></span>Sent
          </span>
        );
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400"></span>Queued
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400 animate-pulse"></span>Processing
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"></span>Failed
          </span>
        );
      default:
        return null;
    }
  };

  const isSpm = session?.user?.role === 'SENIOR_PRODUCT_MANAGER';

  const tabs: TabType[] = ['ALL', 'QUEUED', 'PROCESSING', 'FAILED', 'SENT'];

  return (
    <div id="queue-screen" className="flex flex-col flex-1 text-slate-200">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-slate-800/60 bg-slate-900/80 backdrop-blur-md px-6">
        <span className="text-base font-semibold tracking-tight text-slate-100">Email Queue</span>
      </div>
      <div className="flex-1 p-6">
        <div className="mb-6 flex gap-1 rounded-lg bg-slate-900/60 border border-slate-800 p-1 w-fit">
          {tabs.map((tab) => (
            <button
              key={tab}
              className={`cursor-pointer rounded-md px-4 py-2 text-xs font-semibold transition-all ${
                activeTab === tab
                  ? 'bg-indigo-500 text-white'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
              onClick={() => {
                setActiveTab(tab);
                setPage(1);
              }}
            >
              {tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-slate-300">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="px-4 py-3">Job ID</th>
                  <th className="px-4 py-3">To</th>
                  <th className="px-4 py-3">Subject</th>
                  {isSpm && <th id="q-by-col" className="px-4 py-3">Created by</th>}
                  <th className="px-4 py-3">Queued at</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Failure Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading && queue.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 7 : 6} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                        <span>Loading queue...</span>
                      </div>
                    </td>
                  </tr>
                ) : queue.length === 0 ? (
                  <tr>
                    <td colSpan={isSpm ? 7 : 6} className="px-6 py-20 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="rounded-full bg-slate-900/60 p-4 border border-slate-800 text-slate-500">
                          <Clock size={32} strokeWidth={1.5} />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-300">No items in this queue tab</p>
                          <p className="text-xs text-slate-500">Items queued or sending will appear here.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  queue.map((item) => (
                    <tr key={item._id} data-status={item.status.toLowerCase()} className="transition-colors hover:bg-slate-800/30">
                      <td className="px-4 py-3 font-mono text-[10.5px] text-slate-500" title={item._id}>
                        {item._id.substring(0, 8)}…
                      </td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-slate-300" title={item.to_addresses.join(', ')}>
                        {item.to_addresses[0]}
                        {item.to_addresses.length > 1 && (
                          <span className="ml-1 text-[10px] text-indigo-400 font-sans font-medium bg-indigo-500/10 px-1.5 py-0.5 rounded">
                            +{item.to_addresses.length - 1}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-200 max-w-[240px] truncate" title={item.subject}>
                        {item.subject}
                      </td>
                      {isSpm && <td className="px-4 py-3 text-slate-300">{item.created_by?.full_name || 'System'}</td>}
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                        {formatDate(item.createdAt)}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(item.status)}</td>
                      <td className={`px-4 py-3 text-xs font-medium ${item.status === 'FAILED' ? 'text-rose-400' : 'text-slate-500'}`}>
                        {item.failure_reason || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 px-3.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span className="font-mono text-[11.5px] text-slate-400">
            Page <span className="font-semibold text-slate-200">{page}</span> of <span className="font-semibold text-slate-200">{Math.max(1, pages)}</span>
          </span>
          <button
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900 px-3.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-all hover:bg-slate-800 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={page >= pages || loading}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
