'use client';

import React, { useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import PaymentSimulatorView from '@/components/PaymentSimulatorView';
import { useRouter } from 'next/navigation';

export default function StandaloneDemoPayPage() {
  const router = useRouter();
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        } else {
          router.replace('/');
        }
      })
      .catch(() => router.replace('/'))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0A0E14] flex items-center justify-center text-slate-400">
        <div className="text-xs font-mono">Loading Payment Simulator...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E14] text-slate-100 flex flex-row">
      <Sidebar
        currentTab="demo-pay"
        onTabChange={(tab) => {
          if (tab === 'demo-pay') return;
          router.push(`/?tab=${tab}`);
        }}
        user={user}
        onLogout={async () => {
          await fetch('/api/auth/logout', { method: 'POST' });
          router.replace('/');
        }}
        onOpenAuth={() => {}}
      />
      <main className="flex-1 min-w-0 p-6 md:p-8 overflow-y-auto max-h-screen">
        <PaymentSimulatorView onNavigateTab={(tab) => router.push(`/?tab=${tab}`)} />
      </main>
    </div>
  );
}
