'use client';

import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  PieChart, 
  X,
  Target
} from 'lucide-react';
import { formatINR, parseToPaise } from '@/lib/money';

interface Budget {
  id: string;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: 'Healthy' | 'Warning' | 'Exceeded';
  period: string;
}

interface Category {
  id: string;
  name: string;
}

interface BudgetsViewProps {
  budgets: Budget[];
  categories: Category[];
  loading: boolean;
  onRefresh: () => void;
}

export default function BudgetsView({
  budgets,
  categories,
  loading,
  onRefresh,
}: BudgetsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string>(''); // empty string = overall
  const [amountStr, setAmountStr] = useState('');
  const [period, setPeriod] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const paise = parseToPaise(amountStr);
    if (paise <= 0) {
      setError('Please provide a valid positive budget limit in ₹.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: categoryId ? categoryId : null,
          amount: paise, // Stored in integer minor units (paise)
          period,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Failed to save budget.');
      } else {
        setModalOpen(false);
        setAmountStr('');
        setCategoryId('');
        onRefresh();
      }
    } catch {
      setError('Network error saving budget.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm('Are you sure you want to remove this budget allocation?')) return;
    try {
      const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      } else {
        alert('Failed to delete budget.');
      }
    } catch {
      alert('Network error deleting budget.');
    }
  };

  const getStatusBadge = (status: 'Healthy' | 'Warning' | 'Exceeded') => {
    switch (status) {
      case 'Exceeded':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3 h-3" />
            <span>Exceeded</span>
          </span>
        );
      case 'Warning':
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" />
            <span>Warning (80%+)</span>
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" />
            <span>Healthy</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <span>Budget Control & Spending Caps</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time overspend alerts with strict integer minor-unit thresholds (₹ INR).
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>New Budget Limit</span>
        </button>
      </div>

      {/* Budget Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-[var(--bg-elev-1)] border border-[var(--border-hairline)]" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-12 text-center space-y-3">
          <PieChart className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="font-semibold text-slate-200">No active budget allocations</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Budgets keep you honest. Set an overall monthly cap or assign limits to individual categories to keep expenses on target.
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-lg text-xs font-semibold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Set Budget in 30 seconds</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {budgets.map((b) => (
            <div key={b.id} className="border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: b.categoryColor || '#0F5132' }}
                    />
                    <h3 className="font-bold text-sm text-white">{b.categoryName}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(b.status)}
                    <button
                      onClick={() => handleDeleteBudget(b.id)}
                      className="p-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Delete budget"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-5 space-y-2">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-400 tabular-nums">
                      Spent: <strong className="text-white">{formatINR(b.spentAmount)}</strong>
                    </span>
                    <span className="tabular-nums text-slate-400">
                      Cap: {formatINR(b.limitAmount)}
                    </span>
                  </div>

                  <div className="w-full bg-[var(--bg-base)] h-2 rounded-full overflow-hidden border border-[var(--border-hairline)]">
                    <div
                      style={{ width: `${Math.min(b.percentage, 100)}%` }}
                      className={`h-full rounded-full transition-all duration-500 ${
                        b.status === 'Exceeded'
                          ? 'bg-rose-500'
                          : b.status === 'Warning'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="mt-5 pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between text-xs">
                <span className="text-slate-400 tabular-nums">
                  {b.percentage}% consumed
                </span>
                <span className={`tabular-nums font-semibold ${b.remainingAmount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {b.remainingAmount < 0 ? 'Exceeded by ' : 'Remaining: '}
                  {formatINR(Math.abs(b.remainingAmount))}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Budget Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[var(--bg-elev-1)] border border-[var(--border-hairline)] w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
              <h3 className="font-bold text-sm text-white">Create Budget Allocation</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveBudget} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Scope</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="" className="bg-slate-900 text-white">
                    Overall Monthly Budget (All Expenses)
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      Category: {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Budget Limit (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 15000.00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Recorded in integer minor units ({parseToPaise(amountStr)} paise)
                </p>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Period Cycle</label>
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="MONTHLY" className="bg-slate-900 text-white">Monthly</option>
                  <option value="YEARLY" className="bg-slate-900 text-white">Yearly</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-elev-2)] hover:bg-[var(--bg-elev-3)] text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-lg font-semibold shadow-md disabled:opacity-50 transition-all active:scale-95"
                >
                  {submitting ? 'Saving...' : 'Set Budget Limit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
