import React from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If there's no session, redirect to login (additional protection besides middleware)
  if (!session || !session.user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar user={session.user} />
      <main className="ml-[280px] flex min-h-screen flex-1 flex-col">
        {children}
      </main>
    </div>
  );
}
