'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Users, 
  Activity, 
  Sparkles, 
  ToggleLeft, 
  ToggleRight,
  TrendingUp,
  Sliders,
  DollarSign
} from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function AdminAnalyticsView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/analytics');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleToggleFlag = async (key: string, currentEnabled: number) => {
    const nextVal = currentEnabled === 1 ? 0 : 1;
    await fetch('/api/admin/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled: nextVal }),
    });
    fetchAnalytics();
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading Platform Analytics & Feature Flags...</div>;
  }

  const { analytics, featureFlags, dailyTransactions } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Platform Analytics & Feature Flags</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time platform activity metrics, AI token consumption estimation, and zero-downtime feature flag toggles.
          </p>
        </div>
      </div>

      {/* Analytics KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-400">Total Registered Users</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{analytics.totalUsers}</div>
          <div className="text-[11px] text-emerald-400 font-mono">DAU / MAU: {analytics.dauMauRatio}</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-400">Total Transactions Ledgers</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">{analytics.totalTransactions}</div>
          <div className="text-[11px] text-slate-400 font-mono tabular-nums">Volume: {formatINR(analytics.totalVolumeCents)}</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-400">AI Inquiries Executed</div>
          <div className="text-2xl font-bold font-mono text-violet-400 mt-1">{analytics.aiTotalCalls}</div>
          <div className="text-[11px] text-slate-400 font-mono">~{analytics.aiEstimatedTokens} tokens consumed</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm space-y-1">
          <div className="text-xs text-slate-400">Estimated LLM Cost (30d)</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">{analytics.aiEstimatedCostUsd}</div>
          <div className="text-[11px] text-slate-400 font-mono">Local fallback active</div>
        </div>
      </div>

      {/* Feature Flags Panel */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-indigo-400" />
            <span>Platform Feature Flags & Runtime Configuration</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">Instant hot-reload</span>
        </div>

        <div className="divide-y divide-slate-800">
          {featureFlags.map((flag: any) => (
            <div key={flag.id} className="py-3.5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-white">{flag.name}</span>
                  <span className="text-[10px] font-mono text-slate-500">({flag.key})</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{flag.description}</p>
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                  Last updated by: {flag.last_modified_by || 'system'}
                </div>
              </div>

              <button
                onClick={() => handleToggleFlag(flag.key, flag.enabled)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  flag.enabled === 1
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                <span>{flag.enabled === 1 ? 'ENABLED' : 'DISABLED'}</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
