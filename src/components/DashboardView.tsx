'use client';

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank, 
  Plus, 
  Download, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  FileSpreadsheet,
  FileJson,
  Calendar,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { formatINR } from '@/lib/money';

interface DashboardViewProps {
  data: {
    kpis: {
      totalBalance: number;
      totalIncome: number;
      totalExpense: number;
      savingsRate: number;
      transactionCount: number;
    };
    categorySpending: Array<{
      id: string;
      name: string;
      color: string;
      icon: string;
      total_amount: number;
      count: number;
    }>;
    recentTransactions: Array<{
      id: string;
      amount: number;
      type: string;
      description: string;
      date: string;
      payment_method: string;
      category_name: string | null;
      category_color: string | null;
      anomaly_id?: string | null;
      anomaly_rule?: string | null;
      anomaly_level?: string | null;
    }>;
    monthlyTrends: Array<{
      month: string;
      income: number;
      expense: number;
    }>;
    overallBudget: {
      limit: number;
      spent: number;
      remainingCents: number;
      percentage: number;
      status: 'Healthy' | 'Warning' | 'Exceeded';
    };
    flaggedTransactions?: Array<{
      id: string;
      transaction_id: string | null;
      rule: string;
      severity: number | string;
      level: 'LOW' | 'MEDIUM' | 'HIGH';
      title: string;
      description: string;
      created_at: string;
      transaction_amount: number | null;
      transaction_description: string | null;
      transaction_date: string | null;
      category_name: string | null;
    }>;
  } | null;
  loading: boolean;
  onOpenAddTx: () => void;
  onNavigateTab: (tab: string) => void;
}

export default function DashboardView({
  data,
  loading,
  onOpenAddTx,
  onNavigateTab,
}: DashboardViewProps) {
  if (loading || !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-[#11161F] border border-white/5 rounded-xl skeleton-shimmer" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-80 bg-[#11161F] border border-white/5 rounded-xl skeleton-shimmer" />
          <div className="lg:col-span-5 h-80 bg-[#11161F] border border-white/5 rounded-xl skeleton-shimmer" />
        </div>
      </div>
    );
  }

  const kpis = {
    totalBalance: data?.kpis?.totalBalance ?? 0,
    totalIncome: data?.kpis?.totalIncome ?? 0,
    totalExpense: data?.kpis?.totalExpense ?? 0,
    savingsRate: data?.kpis?.savingsRate ?? 0,
    transactionCount: data?.kpis?.transactionCount ?? 0,
  };
  const categorySpending = Array.isArray(data?.categorySpending) ? data.categorySpending : [];
  const recentTransactions = Array.isArray(data?.recentTransactions) ? data.recentTransactions : [];
  const monthlyTrends = Array.isArray(data?.monthlyTrends) ? data.monthlyTrends : [];
  const overallBudget = data?.overallBudget || { limit: 0, spent: 0, remainingCents: 0, percentage: 0, status: 'Healthy' as const };
  const flaggedTransactions = Array.isArray(data?.flaggedTransactions) ? data.flaggedTransactions : [];

  const handleExport = (format: 'csv' | 'json') => {
    window.location.href = `/api/export?format=${format}`;
  };

  // Sparkline generator helper safely guarded
  const maxTrend = (monthlyTrends && monthlyTrends.length > 0)
    ? Math.max(...monthlyTrends.map((t) => Math.max(t?.income || 0, t?.expense || 0)), 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Actions */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Financial Overview</h1>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              INR · en-IN
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ledger metrics, AI-flagged anomaly monitoring, and automated budget ceiling tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-[#0A0E14] border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 text-slate-300 rounded-md text-xs font-medium transition-all"
              title="Download CSV export"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport('json')}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 text-slate-300 rounded-md text-xs font-medium transition-all"
              title="Download JSON export"
            >
              <FileJson className="w-3.5 h-3.5 text-amber-400" />
              <span>JSON</span>
            </button>
          </div>

          <button
            onClick={onOpenAddTx}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0F5132] hover:bg-[#146c43] text-white rounded-lg text-xs font-semibold shadow-sm transition-all fintech-btn active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Record Transaction</span>
          </button>
        </div>
      </div>

      {/* 2.1 TOP METRIC GRID (Fintech Native, No Purple, ₹ tabular-nums) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Balance */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Net Surplus</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${kpis.totalBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatINR(kpis.totalBalance)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span>{kpis.transactionCount} ledger records</span>
            </div>
          </div>
        </div>

        {/* 2. Total Income */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Income</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              INFLOW
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums text-emerald-400">
              +{formatINR(kpis.totalIncome)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span>Salary & Corporate Credits</span>
            </div>
          </div>
        </div>

        {/* 3. Total Expenses */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Expenses</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
              OUTFLOW
            </span>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums text-rose-400">
              -{formatINR(kpis.totalExpense)}
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <TrendingDown className="w-3 h-3 text-rose-400" />
              <span>Living & Discretionary Outflow</span>
            </div>
          </div>
        </div>

        {/* 4. Savings Rate */}
        <div className="fintech-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Savings Rate</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <PiggyBank className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight tabular-nums text-amber-400">
              {kpis.savingsRate}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              {kpis.savingsRate >= 20 ? 'Target achieved (≥20%)' : 'Needs attention (<20%)'}
            </div>
            <div className="w-full bg-[#0A0E14] h-1.5 rounded-full mt-2 overflow-hidden border border-white/5">
              <div 
                style={{ width: `${Math.min(kpis.savingsRate, 100)}%` }} 
                className={`h-full rounded-full transition-all duration-500 ${kpis.savingsRate >= 20 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section (Monthly Trends & Category Outflow) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (60%): Cash-Flow Trends */}
        <div className="lg:col-span-7 fintech-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-white">Monthly Cash Flow</h3>
                <p className="text-[11px] text-slate-400">Inflow vs Outflow distribution across last 6 months</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-slate-400">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
                  <span className="text-slate-400">Expense</span>
                </div>
              </div>
            </div>

            {/* Visual Bar Graph */}
            <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b border-white/10">
              {monthlyTrends.map((trend) => {
                const incHeight = maxTrend > 0 ? (trend.income / maxTrend) * 100 : 0;
                const expHeight = maxTrend > 0 ? (trend.expense / maxTrend) * 100 : 0;

                return (
                  <div key={trend.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="w-full flex items-end justify-center gap-1.5 h-full relative">
                      {/* Income Bar */}
                      <div
                        style={{ height: `${Math.max(incHeight, 4)}%` }}
                        className="w-1/2 bg-emerald-500/80 hover:bg-emerald-400 rounded-t-sm transition-all"
                        title={`Income: ${formatINR(trend.income)}`}
                      />
                      {/* Expense Bar */}
                      <div
                        style={{ height: `${Math.max(expHeight, 4)}%` }}
                        className="w-1/2 bg-rose-500/80 hover:bg-rose-400 rounded-t-sm transition-all"
                        title={`Expense: ${formatINR(trend.expense)}`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300">
                      {trend.month.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Currency: INR (₹)</span>
            <span>All values in exact minor units</span>
          </div>
        </div>

        {/* Right Column (40%): Overall Budget Health */}
        <div className="lg:col-span-5 fintech-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-white">Monthly Budget Cap</h3>
                <p className="text-[11px] text-slate-400">Aggregated spending ceiling</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                overallBudget.status === 'Exceeded'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : overallBudget.status === 'Warning'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {overallBudget.status.toUpperCase()}
              </span>
            </div>

            {/* Alert Banner */}
            <div className={`p-3 rounded-lg border text-xs mb-4 flex items-start gap-2.5 ${
              overallBudget.status === 'Exceeded'
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                : overallBudget.status === 'Warning'
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              {overallBudget.status === 'Exceeded' ? (
                <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              ) : overallBudget.status === 'Warning' ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-semibold">
                  {overallBudget.status === 'Exceeded'
                    ? 'Budget Exceeded'
                    : overallBudget.status === 'Warning'
                    ? 'Approaching Limit'
                    : 'Within Spending Target'}
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {overallBudget.status === 'Exceeded'
                    ? `Expenditure has exceeded target cap by ${formatINR(Math.abs(overallBudget.remainingCents))}.`
                    : overallBudget.status === 'Warning'
                    ? `Consumed ${overallBudget.percentage}% of your planned monthly budget cap.`
                    : `You have ${formatINR(overallBudget.remainingCents)} left within your healthy spending ceiling.`}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between items-end text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Spent / Limit</span>
                  <span className="font-bold font-mono text-white tabular-nums">
                    {formatINR(overallBudget.spent)}
                  </span>
                  <span className="text-slate-400 font-mono ml-1 tabular-nums">
                    / {formatINR(overallBudget.limit)}
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-200 tabular-nums">
                  {overallBudget.percentage}%
                </span>
              </div>

              <div className="w-full bg-[#0A0E14] h-2.5 rounded-full overflow-hidden border border-white/5">
                <div
                  style={{ width: `${Math.min(overallBudget.percentage, 100)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    overallBudget.status === 'Exceeded'
                      ? 'bg-rose-500'
                      : overallBudget.status === 'Warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('budgets')}
            className="w-full mt-4 py-2 px-3 rounded-lg bg-[#0A0E14] hover:bg-[#1A2029] border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all text-center flex items-center justify-center gap-1.5"
          >
            <span>Configure Category Budgets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Flagged Transactions Card (Top 3 Unacknowledged Anomalies) */}
      <div className="fintech-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-white">Flagged Transactions</h3>
              <p className="text-[11px] text-slate-400">Heuristic anomaly detector highlights</p>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('alerts')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>View all alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {!flaggedTransactions || flaggedTransactions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2 bg-[#0A0E14] rounded-lg border border-white/5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero unacknowledged anomalies. All ledger items match typical spending behavior.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {flaggedTransactions.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="p-3.5 rounded-lg bg-[#0A0E14] border border-white/10 hover:border-amber-500/30 transition-all flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 font-bold">
                      {a.level} ({a.severity})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {a.transaction_date || a.created_at.slice(0, 10)}
                    </span>
                  </div>

                  <h4 className="font-semibold text-xs text-white truncate">{a.title}</h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {a.description}
                  </p>
                  {a.transaction_amount !== null && (
                    <div className="mt-2 text-xs font-mono font-bold text-rose-300 tabular-nums">
                      Charge: {formatINR(a.transaction_amount)}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                  <span className="text-slate-500 font-mono text-[10px]">{a.rule}</span>
                  <button
                    onClick={() => onNavigateTab('alerts')}
                    className="text-emerald-400 hover:text-emerald-300 font-semibold"
                  >
                    Review &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions Feed */}
      <div className="fintech-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm text-white">Recent Ledger Transactions</h3>
            <p className="text-[11px] text-slate-400">Latest financial movements on your account</p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>View full ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-white/5">
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No transactions recorded yet. Click &quot;Record Transaction&quot; to begin!
            </div>
          ) : (
            recentTransactions.map((tx: any) => (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-4 fintech-row">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: `${tx.category_color || '#10B981'}15`,
                      color: tx.category_color || '#10B981',
                    }}
                  >
                    {tx.category_name ? tx.category_name.slice(0, 2).toUpperCase() : 'TX'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <span>{tx.description}</span>
                      {tx.anomaly_id && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-pointer"
                          onClick={() => onNavigateTab('alerts')}
                        >
                          ⚠️ Flagged
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                      <span className="font-mono">{tx.date}</span>
                      <span>&bull;</span>
                      <span>{tx.category_name || 'General'}</span>
                      <span>&bull;</span>
                      <span className="font-mono">{tx.payment_method}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`text-xs font-mono font-bold tabular-nums whitespace-nowrap ${
                    tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}
                  {formatINR(tx.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
