'use client';

import React, { useState } from 'react';
import { FileText, Download, Calendar, TrendingUp, TrendingDown, Sparkles, Receipt, Tag } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function ReportsView() {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');
  const [yearMode, setYearMode] = useState<'CY' | 'FY'>('FY'); // Financial Year (Apr–Mar) vs Calendar Year

  const months = ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05'];

  const handleDownloadPdf = () => {
    alert(`Generating PDF financial breakdown for ${selectedMonth} [${yearMode === 'FY' ? 'Financial Year 2026-27' : 'Calendar Year 2026'}]... (Downloaded)`);
  };

  // Indian financial metrics based on seed data (Salary ₹85,000, Outflows ~₹31,450)
  const inflowMinor = 8500000;
  const outflowMinor = 3145000;
  const surplusMinor = inflowMinor - outflowMinor;
  const savingsRate = Math.round((surplusMinor / inflowMinor) * 100);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Financial Reports & Tax Dossiers</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive financial dossiers with cash-flow analysis, GST/TDS tax tags, and Indian Financial Year accounting.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* 5.1 Financial Year Toggle (Apr–Mar vs Calendar Year) */}
          <div className="flex items-center bg-[#0A0E14] border border-white/10 rounded-lg p-0.5 text-xs font-medium">
            <button
              onClick={() => setYearMode('CY')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                yearMode === 'CY' ? 'bg-[#1A2029] text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Calendar Year
            </button>
            <button
              onClick={() => setYearMode('FY')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                yearMode === 'FY' ? 'bg-[#0F5132] text-emerald-300 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Financial Year (Apr–Mar)
            </button>
          </div>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#0F5132] hover:bg-[#146c43] text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Month Metrics Header (₹ formatted) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="border border-white/10 bg-[#11161F] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400">Total Inflow</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1 tabular-nums">+{formatINR(inflowMinor)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Salary & Corporate Credits</div>
        </div>

        <div className="border border-white/10 bg-[#11161F] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400">Total Outflow</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1 tabular-nums">-{formatINR(outflowMinor)}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Living, SIP & Variable Spends</div>
        </div>

        <div className="border border-white/10 bg-[#11161F] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400">Net Surplus</div>
          <div className="text-2xl font-bold font-mono text-white mt-1 tabular-nums">+{formatINR(surplusMinor)}</div>
          <div className="text-[10px] text-emerald-400 font-mono mt-0.5">Retained capital ({yearMode === 'FY' ? 'FY 26-27' : 'CY 2026'})</div>
        </div>

        <div className="border border-white/10 bg-[#11161F] rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-400">Savings Rate</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1 tabular-nums">{savingsRate}%</div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Above 20% RBI benchmark</div>
        </div>
      </div>

      {/* 5.2 Indian Tax & GST / TDS Reconciliation Section */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-sm text-white">GST & TDS Compliance Tracking</h3>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            Indian Income Tax Act
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#0A0E14] border border-white/5 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-slate-400">Section 194J / TDS Deductions</div>
              <div className="text-white font-mono font-bold mt-1 tabular-nums">{formatINR(0)}</div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">Form 26AS Ready</span>
          </div>
          <div className="p-3 bg-[#0A0E14] border border-white/5 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-slate-400">GST Input Tax Credit Eligible</div>
              <div className="text-white font-mono font-bold mt-1 tabular-nums">{formatINR(185000)}</div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">GSTR-2B Mapped</span>
          </div>
          <div className="p-3 bg-[#0A0E14] border border-white/5 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-slate-400">Section 80C Eligible (SIP / PPF)</div>
              <div className="text-white font-mono font-bold mt-1 tabular-nums">{formatINR(500000)}</div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">₹1.5L Limit Active</span>
          </div>
        </div>
      </div>

      {/* AI Executive Summary Card */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-emerald-400">
          <Sparkles className="w-4 h-4" />
          <h3 className="font-semibold text-sm text-white">AI Financial Summary ({selectedMonth} — {yearMode === 'FY' ? 'Indian Fiscal Year' : 'Calendar Year'})</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          In {selectedMonth}, your financial posture remained strong with a resilient <strong>{savingsRate}% savings rate</strong>. The largest singular outflow was your monthly apartment lease ({formatINR(2200000)}), followed by mutual fund investments into Nippon Small Cap SIP ({formatINR(500000)}). You maintained a healthy surplus of {formatINR(surplusMinor)}. All UPI and credit card records have been reconciled with zero unacknowledged anomalies.
        </p>
      </div>
    </div>
  );
}
