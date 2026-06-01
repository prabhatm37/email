'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { SquarePen, Send, List, LayoutTemplate, Signature, Users, LogOut } from 'lucide-react';

interface SidebarProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    status: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();

  // Get initials for avatar
  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const isSpm = user.role === 'SENIOR_PRODUCT_MANAGER';

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const navItems = [
    {
      name: 'Compose',
      path: '/compose',
      icon: <SquarePen size={18} strokeWidth={1.8} />,
    },
    {
      name: 'Sent Emails',
      path: '/sent',
      icon: <Send size={18} strokeWidth={1.8} />,
    },
    {
      name: 'Queue',
      path: '/queue',
      icon: <List size={18} strokeWidth={1.8} />,
    },
  ];

  const libraryItems = [
    {
      name: 'Signatures',
      path: '/signatures',
      icon: <Signature size={18} strokeWidth={1.8} />,
    },
    {
      name: 'Templates',
      path: '/templates',
      icon: <LayoutTemplate size={18} strokeWidth={1.8} />,
    },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-[280px] flex-col border-r border-slate-800/60 bg-slate-900/60 backdrop-blur-xl">
      <div className="flex h-14 shrink-0 flex-col justify-center border-b border-slate-800/60 px-5">
        <div className="text-[16px] font-bold tracking-tight text-indigo-500 leading-none">
          Email Management Portal
        </div>
        <div className="mt-0.5 text-[10px] font-semibold text-slate-500 leading-none">
          M37Labs
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Library</div>
          <div className="space-y-1">
            {libraryItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`group flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                >
                  <span className={`${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`}>
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        <div>
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Mail</div>
          <div className="space-y-1">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.path);
              return (
                <Link
                  key={item.name}
                  href={item.path}
                  className={`group flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${isActive
                    ? 'bg-indigo-500/10 text-indigo-400'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                >
                  <span className={`${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`}>
                    {item.icon}
                  </span>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>

        {isSpm && (
          <div>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Admin</div>
            <div className="space-y-1">
              <Link
                href="/users"
                className={`group flex cursor-pointer select-none items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${pathname.startsWith('/users')
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`}
              >
                <span className={`${pathname.startsWith('/users') ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'} transition-colors`}>
                  <Users size={18} strokeWidth={1.8} />
                </span>
                Users
              </Link>
            </div>
          </div>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-slate-700/30 bg-slate-800/40 p-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500 font-[var(--font-ibm-plex-mono)] text-xs font-bold text-white">
          {getInitials(user.name)}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-semibold text-slate-200" title={user.name || ''}>
            {user.name}
          </div>
          <div className="truncate text-xs font-medium text-slate-400">
            {user.role === 'SENIOR_PRODUCT_MANAGER' ? 'Sr. Product Manager' : 'Product Manager'}
          </div>
        </div>
        <button
          className="flex cursor-pointer items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          onClick={handleLogout}
          title="Sign out"
        >
          <LogOut size={16} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
