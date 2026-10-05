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
  FileJson
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
      <div className="space-y-6 animate-pulse">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-white/[0.03] border border-white/5" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 rounded-2xl bg-white/[0.03] border border-white/5" />
          <div className="h-72 rounded-2xl bg-white/[0.03] border border-white/5" />
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
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/40 via-slate-900/40 to-slate-950/40 p-5 rounded-2xl border border-indigo-500/20 backdrop-blur-md">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Financial Overview</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Live Minor Units
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time ledger with zero float drift and cryptographically hash-chained audit trails.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadExport('csv')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 transition-all"
            title="Download verified user transactions as CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV</span>
          </button>

          <button
            onClick={() => downloadExport('json')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 transition-all"
            title="Download complete JSON export"
          >
            <FileJson className="w-3.5 h-3.5 text-indigo-400" />
            <span>JSON</span>
          </button>

          <button
            onClick={() => onNavigateTab('ai')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>AI Advice</span>
          </button>

          <button
            onClick={onOpenAddTx}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Transaction</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Balance */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Net Balance</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-bold font-mono tracking-tight ${kpis.totalBalance >= 0 ? 'text-white' : 'text-rose-400'}`}>
              {formatCents(kpis.totalBalance)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <span>{kpis.transactionCount} transactions recorded</span>
            </div>
          </div>
        </div>

        {/* Total Income */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Inflow</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-emerald-400">
              +{formatCents(kpis.totalIncome)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Recorded income streams
            </div>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Outflow</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-rose-400">
              -{formatCents(kpis.totalExpense)}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Cumulative expenditure
            </div>
          </div>
        </div>

        {/* Savings Rate */}
        <div className="glass-panel p-5 rounded-2xl glass-panel-hover">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Savings Rate</span>
            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold font-mono tracking-tight text-violet-300">
              {kpis.savingsRate}%
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              {kpis.savingsRate >= 20 ? '✅ Above 20% target' : '⚠️ Below 20% target'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Trends */}
        <div className="lg:col-span-2 glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm text-slate-200">Cash Flow Trends</h3>
                <p className="text-xs text-slate-400">Monthly Income vs Expenditure comparison</p>
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

            {/* Visual Bar Graph */}
            <div className="mt-6 space-y-4">
              {monthlyTrends.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-slate-500">
                  No monthly trend records yet.
                </div>
              ) : (
                monthlyTrends.map((trend) => {
                  const maxVal = Math.max(...monthlyTrends.map((t) => Math.max(t.income, t.expense)), 1);
                  const incomePct = Math.round((trend.income / maxVal) * 100);
                  const expensePct = Math.round((trend.expense / maxVal) * 100);

                  return (
                    <div key={trend.month} className="space-y-1">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300 font-semibold">{trend.month}</span>
                        <div className="flex gap-4">
                          <span className="text-emerald-400">+{formatCents(trend.income)}</span>
                          <span className="text-rose-400">-{formatCents(trend.expense)}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 h-4 bg-white/[0.02] rounded-full p-0.5">
                        <div className="w-full flex justify-end">
                          <div
                            style={{ width: `${incomePct}%` }}
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            title={`Income: ${formatCents(trend.income)}`}
                          />
                        </div>
                        <div className="w-full flex justify-start">
                          <div
                            style={{ width: `${expensePct}%` }}
                            className="h-full bg-rose-500 rounded-full transition-all duration-500"
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

          {/* Overall Monthly Budget Widget */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <span>Monthly Budget Cap</span>
                {overallBudget.status === 'Exceeded' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                    EXCEEDED
                  </span>
                )}
                {overallBudget.status === 'Warning' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                    WARNING
                  </span>
                )}
                {overallBudget.status === 'Healthy' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                    HEALTHY
                  </span>
                )}
              </span>
              <span className="font-mono text-slate-400">
                {overallBudget.limit > 0
                  ? `${formatCents(overallBudget.spent)} / ${formatCents(overallBudget.limit)} (${overallBudget.percentage}%)`
                  : 'No limit set'}
              </span>
            </div>

            <div className="w-full bg-white/5 h-2 rounded-full mt-2 overflow-hidden">
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

        {/* Category Spending Breakdown */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-slate-200">Expense Breakdown</h3>
              <span className="text-xs text-slate-400 font-mono">
                {categorySpending.length} Categories
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Top expenditure allocations</p>

            <div className="mt-5 space-y-3.5">
              {categorySpending.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">
                  No expense records found.
                </div>
              ) : (
                categorySpending.slice(0, 5).map((cat) => {
                  const pct = kpis.totalExpense > 0 ? Math.round((cat.total_amount / kpis.totalExpense) * 100) : 0;
                  return (
                    <div key={cat.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: cat.color || '#3B82F6' }}
                          />
                          <span className="text-slate-200 font-medium">{cat.name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-200">{formatCents(cat.total_amount)}</span>
                          <span className="text-[10px] text-slate-400 w-8 text-right">{pct}%</span>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${pct}%`,
                            backgroundColor: cat.color || '#3B82F6',
                          }}
                          className="h-full rounded-full transition-all duration-500"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('budgets')}
            className="w-full mt-6 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all text-center"
          >
            Configure Budgets & Limits &rarr;
          </button>
        </div>
      </div>

      {/* Recent Transactions List */}
      <div className="glass-panel p-6 rounded-2xl">
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

        <div className="divide-y divide-white/5">
          {recentTransactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No transactions recorded yet. Click &quot;Add Transaction&quot; to begin!
            </div>
          ) : (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs"
                    style={{
                      backgroundColor: `${tx.category_color || '#6366F1'}20`,
                      color: tx.category_color || '#818CF8',
                    }}
                  >
                    {tx.category_name ? tx.category_name.slice(0, 2).toUpperCase() : 'TX'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{tx.description}</div>
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
