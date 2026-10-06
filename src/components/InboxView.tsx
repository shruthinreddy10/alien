'use client';

import React, { useState, useEffect } from 'react';
import { 
  Inbox, 
  Smartphone, 
  CreditCard, 
  Mail, 
  Check, 
  X, 
  Edit3, 
  Sparkles, 
  CheckCheck, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { formatINR } from '@/lib/money';

interface InboxNotification {
  id: string;
  source: 'UPI' | 'CARD' | 'EMAIL';
  amount_minor: number;
  merchant: string;
  raw_payload: string;
  suggested_category_id: string;
  category_name?: string;
  category_color?: string;
  confidence: 'HIGH' | 'MED' | 'LOW';
  status: 'PENDING' | 'CONFIRMED' | 'IGNORED';
  received_at: string;
}

export default function InboxView({ onRefreshDashboard }: { onRefreshDashboard?: () => void }) {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [counts, setCounts] = useState({
    totalPending: 0,
    upi: 0,
    card: 0,
    email: 0,
    highConfidence: 0,
  });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'ALL' | 'UPI' | 'CARD' | 'EMAIL' | 'CONFIRMED'>('ALL');
  const [simulating, setSimulating] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [animatingOutId, setAnimatingOutId] = useState<string | null>(null);

  const fetchInbox = async () => {
    try {
      setLoading(true);
      const statusParam = tab === 'CONFIRMED' ? 'CONFIRMED' : 'PENDING';
      const sourceParam = tab === 'ALL' || tab === 'CONFIRMED' ? 'ALL' : tab;
      const res = await fetch(`/api/v1/inbox?status=${statusParam}&source=${sourceParam}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        if (data.counts) setCounts(data.counts);
      }
    } catch (e) {
      console.error('Failed to load payments inbox:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInbox();
  }, [tab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // One-click Confirm
  const handleConfirm = async (item: InboxNotification) => {
    setActionInProgress(item.id);
    setAnimatingOutId(item.id);
    try {
      const res = await fetch(`/api/v1/inbox/${item.id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        showToast(`${formatINR(item.amount_minor)} added to ${item.category_name || 'Expenses'}. (Transaction logged)`);
        setNotifications((prev) => prev.filter((n) => n.id !== item.id));
        setCounts((prev) => ({
          ...prev,
          totalPending: Math.max(0, prev.totalPending - 1),
          highConfidence: item.confidence === 'HIGH' ? Math.max(0, prev.highConfidence - 1) : prev.highConfidence,
        }));
        if (onRefreshDashboard) onRefreshDashboard();
      }
    } catch (e) {
      console.error('Confirm error:', e);
    } finally {
      setActionInProgress(null);
      setAnimatingOutId(null);
    }
  };

  // One-click Ignore
  const handleIgnore = async (item: InboxNotification) => {
    setActionInProgress(item.id);
    setAnimatingOutId(item.id);
    try {
      const res = await fetch(`/api/v1/inbox/${item.id}/ignore`, { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== item.id));
        setCounts((prev) => ({
          ...prev,
          totalPending: Math.max(0, prev.totalPending - 1),
        }));
      }
    } catch (e) {
      console.error('Ignore error:', e);
    } finally {
      setActionInProgress(null);
      setAnimatingOutId(null);
    }
  };

  // Bulk confirm high confidence
  const handleBulkConfirmHigh = async () => {
    try {
      setActionInProgress('bulk');
      const res = await fetch('/api/v1/inbox/bulk-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onlyHighConfidence: true }),
      });
      if (res.ok) {
        const json = await res.json();
        showToast(`Auto-confirmed ${json.confirmedCount} high-confidence notifications.`);
        fetchInbox();
        if (onRefreshDashboard) onRefreshDashboard();
      }
    } catch (e) {
      console.error('Bulk confirm error:', e);
    } finally {
      setActionInProgress(null);
    }
  };

  // 3.4 Live Simulation: generate incoming notification
  const handleSimulate = async () => {
    try {
      setSimulating(true);
      const res = await fetch('/api/v1/inbox/simulate', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        showToast(`⚡ Incoming ${json.notification.source} notification: ${json.notification.merchant} (${formatINR(json.notification.amount_minor)})`);
        if (tab !== 'CONFIRMED') {
          setNotifications((prev) => [json.notification, ...prev]);
          setCounts((prev) => ({
            ...prev,
            totalPending: prev.totalPending + 1,
            highConfidence: json.notification.confidence === 'HIGH' ? prev.highConfidence + 1 : prev.highConfidence,
          }));
        }
      }
    } catch (e) {
      console.error('Simulate error:', e);
    } finally {
      setSimulating(false);
    }
  };

  // Relative time helper
  const getTimeAgo = (iso: string) => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification Container (Bottom-Right with countdown bar) */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md bg-[#11161F] border border-emerald-500/30 text-white p-4 rounded-xl shadow-2xl flex flex-col gap-2 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full w-full animate-[shrink_4s_linear]" />
          </div>
        </div>
      )}

      {/* Header & Controls */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Payments Inbox</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              LIVE INGESTION
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Autonomous ingestion of real-world input sources (UPI notifications, credit card swipe alerts, and email receipts). Confirm in one tap with zero manual typing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* 3.4 Live Demo Simulate Button */}
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="flex items-center gap-2 px-4 py-2 bg-[#0F5132] hover:bg-[#146c43] text-white rounded-lg text-xs font-semibold shadow-sm transition-all fintech-btn active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${simulating ? 'animate-spin' : ''}`} />
            <span>Simulate Incoming</span>
          </button>
        </div>
      </div>

      {/* Tabs and Bulk Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All', count: counts.totalPending },
            { id: 'UPI', label: 'UPI', count: counts.upi },
            { id: 'CARD', label: 'Cards', count: counts.card },
            { id: 'EMAIL', label: 'Email Receipts', count: counts.email },
            { id: 'CONFIRMED', label: 'Confirmed History' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                tab === t.id
                  ? 'bg-[#1A2029] text-white border border-white/10'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  tab === t.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab !== 'CONFIRMED' && counts.highConfidence > 0 && (
          <button
            onClick={handleBulkConfirmHigh}
            disabled={actionInProgress === 'bulk'}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1A2029] hover:bg-[#232A35] border border-emerald-500/30 text-emerald-300 rounded-lg text-xs font-medium transition-all"
          >
            <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Confirm all high-confidence ({counts.highConfidence})</span>
          </button>
        )}
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-[#11161F] border border-white/5 rounded-xl skeleton-shimmer" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="border border-white/10 bg-[#11161F] rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-400">
            <Check className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-white">Inbox Zero Achieved</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            All UPI, card, and email notifications have been confirmed into your financial ledger. Click "Simulate Incoming" to test a live payment arrival.
          </p>
          <div className="pt-2">
            <button
              onClick={handleSimulate}
              className="px-4 py-2 bg-[#0F5132] hover:bg-[#146c43] text-white rounded-lg text-xs font-semibold"
            >
              Simulate Incoming Payment
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((item) => {
            const isAnimating = animatingOutId === item.id;
            const parsedPayload = (() => {
              try { return JSON.parse(item.raw_payload); } catch { return {}; }
            })();

            return (
              <div
                key={item.id}
                className={`border border-white/10 bg-[#11161F] rounded-xl p-4 transition-all fintech-row flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isAnimating ? 'opacity-0 -translate-x-4 pointer-events-none' : 'opacity-100'
                }`}
              >
                {/* Left: Source, Details & Confidence */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                    item.source === 'UPI'
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : item.source === 'CARD'
                      ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                  }`}>
                    {item.source === 'UPI' && <Smartphone className="w-5 h-5" />}
                    {item.source === 'CARD' && <CreditCard className="w-5 h-5" />}
                    {item.source === 'EMAIL' && <Mail className="w-5 h-5" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-white">{item.merchant}</span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                        {item.source}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        · {getTimeAgo(item.received_at)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-xs text-slate-400">
                        Auto: <strong className="text-slate-200">{item.category_name || 'Food & Dining'}</strong>
                      </span>
                      <span className="text-slate-600">·</span>
                      <div className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${
                          item.confidence === 'HIGH'
                            ? 'bg-emerald-400'
                            : item.confidence === 'MED'
                            ? 'bg-amber-400'
                            : 'bg-slate-400'
                        }`} />
                        <span className="text-[11px] text-slate-400 font-medium">
                          {item.confidence === 'HIGH' ? 'High confidence' : item.confidence === 'MED' ? 'Medium confidence' : 'Low confidence'}
                        </span>
                      </div>
                      {parsedPayload.account && (
                        <span className="text-[11px] text-slate-500 font-mono">
                          ({parsedPayload.account})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Amount & Action Buttons */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-base font-bold font-mono text-white tabular-nums">
                      {formatINR(item.amount_minor)}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-mono">Paise Scoped</div>
                  </div>

                  {item.status === 'PENDING' ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleConfirm(item)}
                        disabled={actionInProgress === item.id}
                        className="px-3 py-1.5 bg-[#0F5132] hover:bg-[#146c43] text-white rounded-lg text-xs font-semibold transition-all fintech-btn active:scale-95 flex items-center gap-1 shadow-sm"
                        title="Confirm as Expense in Ledger"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Confirm</span>
                      </button>

                      <button
                        onClick={() => handleIgnore(item)}
                        disabled={actionInProgress === item.id}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Dismiss notification"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-mono text-emerald-400 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20">
                      Confirmed
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
