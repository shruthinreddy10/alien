'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OverviewRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0A0E14] flex items-center justify-center text-slate-400">
      <div className="text-xs font-mono">Redirecting to Financial Overview...</div>
    </div>
  );
}
