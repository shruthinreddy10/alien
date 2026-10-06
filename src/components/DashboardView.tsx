'use client';

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PiggyBank, 
  Plus, 
  Download, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  FileSpreadsheet,
  FileJson,
  Calendar
} from 'lucide-react';
import { formatCents } from '@/lib/money';

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
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  if (loading || !data) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-20 bg-slate-900 border border-slate-800 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-slate-900 border border-slate-800" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-72 rounded-xl bg-slate-900 border border-slate-800" />
          <div className="lg:col-span-5 h-72 rounded-xl bg-slate-900 border border-slate-800" />
        </div>
      </div>
    );
  }

  const { kpis, categorySpending, recentTransactions, monthlyTrends, overallBudget } = data;

  const downloadExport = (format: 'csv' | 'json') => {
    window.location.href = `/api/export?format=${format}`;
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Financial Overview</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>{currentDate}</span>
            <span>&bull;</span>
            <span className="text-emerald-400 font-mono">Zero Float Drift Active</span>
          </p>
        </div>

        {/* Right-Aligned Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => downloadExport('csv')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-all"
            title="Download verified user transactions as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => downloadExport('json')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-all"
            title="Download complete JSON export"
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => onNavigateTab('ai')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-indigo-200 text-xs font-semibold transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Advice</span>
          </button>

          <button
            onClick={onOpenAddTx}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Transaction</span>
          </button>
        </div>
      </div>

      {/* Top Metric Grid (4 Cards in a single row) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Net Balance */}
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Net Balance</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className={`text-2xl font-bold font-mono tracking-tight ${kpis.totalBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatCents(kpis.totalBalance)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>{kpis.transactionCount} ledger entries</span>
            </div>
          </div>
        </div>

        {/* 2. Total Income */}
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Income</span>
            <div className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400 font-semibold">
              INFLOW
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400">
              +{formatCents(kpis.totalIncome)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>Verified income streams</span>
            </div>
          </div>
        </div>

        {/* 3. Total Expenses */}
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Expenses</span>
            <div className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-400 font-semibold">
              OUTFLOW
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-rose-400">
              -{formatCents(kpis.totalExpense)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
              <span>Cumulative expenditure</span>
            </div>
          </div>
        </div>

        {/* 4. Savings Rate */}
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Savings Rate</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <div className="text-2xl font-bold font-mono tracking-tight text-violet-300">
              {kpis.savingsRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>{kpis.savingsRate >= 20 ? 'Target achieved (≥20%)' : 'Needs attention (<20%)'}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                style={{ width: `${Math.min(kpis.savingsRate, 100)}%` }} 
                className={`h-full rounded-full ${kpis.savingsRate >= 20 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section (2 Columns: 60% Left, 40% Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (60%): Interactive Cash-Flow / Monthly Trends */}
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-sm text-slate-200">Cash Flow Trends</h3>
                <p className="text-xs text-slate-400">Monthly Inflow vs Outflow analysis</p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-slate-400">Income</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-slate-400">Expense</span>
                </div>
              </div>
            </div>

            {/* Visual Bars */}
            <div className="mt-6 space-y-4">
              {monthlyTrends.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No monthly trend records available yet.
                </div>
              ) : (
                monthlyTrends.map((trend) => {
                  const maxVal = Math.max(...monthlyTrends.map((t) => Math.max(t.income, t.expense)), 1);
                  const incomePct = Math.round((trend.income / maxVal) * 100);
                  const expensePct = Math.round((trend.expense / maxVal) * 100);

                  return (
                    <div key={trend.month} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-semibold">{trend.month}</span>
                        <div className="flex gap-4">
                          <span className="text-emerald-400">+{formatCents(trend.income)}</span>
                          <span className="text-rose-400">-{formatCents(trend.expense)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 h-4 bg-slate-800/80 rounded-md p-0.5">
                        <div className="w-full flex justify-end">
                          <div
                            style={{ width: `${incomePct}%` }}
                            className="h-full bg-emerald-500 rounded transition-all duration-500"
                            title={`Income: ${formatCents(trend.income)}`}
                          />
                        </div>
                        <div className="w-full flex justify-start">
                          <div
                            style={{ width: `${expensePct}%` }}
                            className="h-full bg-rose-500 rounded transition-all duration-500"
                            title={`Expense: ${formatCents(trend.expense)}`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Expense Breakdown Category Bars */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <h4 className="text-xs font-semibold text-slate-300 mb-3">Top Category Allocations</h4>
            <div className="space-y-2.5">
              {categorySpending.slice(0, 3).map((cat) => {
                const pct = kpis.totalExpense > 0 ? Math.round((cat.total_amount / kpis.totalExpense) * 100) : 0;
                return (
                  <div key={cat.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{cat.name}</span>
                      <span className="font-mono text-slate-400">{formatCents(cat.total_amount)} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        style={{ width: `${pct}%`, backgroundColor: cat.color || '#6366F1' }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (40%): Budget Status & Alerts */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm text-slate-200">Budget Status & Alerts</h3>
              <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border ${
                overallBudget.status === 'Exceeded'
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : overallBudget.status === 'Warning'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {overallBudget.status.toUpperCase()}
              </span>
            </div>

            {/* Alert banner */}
            <div className={`p-3.5 rounded-lg border text-xs mb-5 flex items-start gap-2.5 ${
              overallBudget.status === 'Exceeded'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : overallBudget.status === 'Warning'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
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
                    ? 'Budget Exceeded!'
                    : overallBudget.status === 'Warning'
                    ? 'Approaching Limit'
                    : 'Spending Under Control'}
                </span>
                <p className="text-[11px] opacity-80 mt-0.5">
                  {overallBudget.status === 'Exceeded'
                    ? `Expenditure has exceeded target cap by ${formatCents(Math.abs(overallBudget.remainingCents))}.`
                    : overallBudget.status === 'Warning'
                    ? `You have consumed ${overallBudget.percentage}% of your planned monthly budget cap.`
                    : `You have ${formatCents(overallBudget.remainingCents)} left within your healthy spending ceiling.`}
                </p>
              </div>
            </div>

            {/* Main Progress Indicator */}
            <div className="space-y-3">
              <div className="flex justify-between items-end text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">Spent vs Allocated</span>
                  <span className="text-base font-bold font-mono text-white">
                    {formatCents(overallBudget.spent)}
                  </span>
                  <span className="text-xs font-mono text-slate-400 ml-1">
                    / {formatCents(overallBudget.limit)}
                  </span>
                </div>
                <span className="font-mono font-bold text-sm text-slate-200">
                  {overallBudget.percentage}%
                </span>
              </div>

              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden p-0.5">
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

              <div className="flex justify-between text-[11px] text-slate-400 font-mono pt-1">
                <span>0%</span>
                <span>80% (Warning)</span>
                <span>100% (Cap)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('budgets')}
            className="w-full mt-6 py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 hover:text-white transition-all text-center"
          >
            Manage Category Budgets &rarr;
          </button>
        </div>
      </div>

      {/* Flagged Transactions Card (Top 3 Unacknowledged Anomalies per 13.1 UI specification) */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <span>Flagged Transactions</span>
                {data.flaggedTransactions && data.flaggedTransactions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-[10px] font-mono text-rose-300 font-bold">
                    {data.flaggedTransactions.length} UNACKNOWLEDGED
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">Heuristic outlier & fraud alerts requiring verification</p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('alerts')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
          >
            <span>View All in Alerts</span>
            <span>&rarr;</span>
          </button>
        </div>

        {(!data.flaggedTransactions || data.flaggedTransactions.length === 0) ? (
          <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>All accounts clear. No unacknowledged anomalies or suspicious charges detected!</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {data.flaggedTransactions.slice(0, 3).map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-lg bg-slate-950 border border-slate-800/90 hover:border-amber-500/40 transition-colors flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        a.level === 'HIGH'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : a.level === 'MEDIUM'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}
                    >
                      {a.level} SEVERITY
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {a.transaction_date || a.created_at.slice(0, 10)}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span className="truncate">{a.title}</span>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                    {a.description}
                  </p>
                  {a.transaction_amount !== null && (
                    <div className="mt-2 text-xs font-mono font-bold text-rose-300">
                      Charge: {formatCents(a.transaction_amount)}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-500 font-mono text-[10px]">{a.rule}</span>
                  <button
                    onClick={() => onNavigateTab('alerts')}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Review &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Section: Recent Ledger Transactions Table */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm text-slate-200">Recent Transactions</h3>
            <p className="text-xs text-slate-400">Latest activity on your account</p>
          </div>
          <button
            onClick={() => onNavigateTab('transactions')}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            View all ledger records &rarr;
          </button>
        </div>

        <div className="divide-y divide-slate-800">
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No transactions recorded yet. Click &quot;Add Transaction&quot; to begin!
            </div>
          ) : (
            recentTransactions.map((tx: any) => (
              <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: `${tx.category_color || '#6366F1'}20`,
                      color: tx.category_color || '#818CF8',
                    }}
                  >
                    {tx.category_name ? tx.category_name.slice(0, 2).toUpperCase() : 'TX'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>{tx.description}</span>
                      {tx.anomaly_id && (
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-0.5 cursor-pointer"
                          title={`Flagged Anomaly: ${tx.anomaly_rule || 'Outlier'}`}
                          onClick={() => onNavigateTab('alerts')}
                        >
                          ⚠️ Flagged
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-2">
                      <span>{tx.date}</span>
                      <span>&bull;</span>
                      <span>{tx.category_name || 'General'}</span>
                      <span>&bull;</span>
                      <span className="font-mono">{tx.payment_method}</span>
                    </div>
                  </div>
                </div>

                <div
                  className={`text-xs font-mono font-bold ${
                    tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {tx.type === 'INCOME' ? '+' : '-'}
                  {formatCents(tx.amount)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
