'use client';

import React, { useState } from 'react';
import { FileText, Download, Calendar, TrendingUp, TrendingDown, Sparkles } from 'lucide-react';
import { formatCents } from '@/lib/money';

export default function ReportsView() {
  const [selectedMonth, setSelectedMonth] = useState('2026-10');

  const months = ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05'];

  const handleDownloadPdf = () => {
    alert(`Generating PDF financial breakdown for ${selectedMonth}... (Downloaded)`);
  };

  return (
    <div className="space-y-6">
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Monthly Financial Reports & Dossiers</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Comprehensive monthly reviews with cash-flow analysis, top spending merchants, and AI-generated executive summaries.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-xs"
          >
            {months.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>

      {/* Month Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Total Inflow</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">+$6,050.00</div>
          <div className="text-[10px] text-slate-500">Salary + Freelance</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Total Outflow</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-1">-$2,255.89</div>
          <div className="text-[10px] text-slate-500">Fixed + Variable Expenses</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Net Surplus</div>
          <div className="text-2xl font-bold font-mono text-white mt-1">+$3,794.11</div>
          <div className="text-[10px] text-emerald-400 font-mono">Retained capital</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Savings Rate</div>
          <div className="text-2xl font-bold font-mono text-violet-400 mt-1">62.7%</div>
          <div className="text-[10px] text-emerald-400">Above 20% target</div>
        </div>
      </div>

      {/* AI Executive Summary Card */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-indigo-400">
          <Sparkles className="w-4 h-4" />
          <h3 className="font-semibold text-sm text-white">AI Assistant Executive Summary ({selectedMonth})</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          In {selectedMonth}, your financial posture remained resilient with a strong <strong>62.7% savings rate</strong>. The largest singular outflow was your monthly apartment lease ($1,450.00), followed by recurring grocery provisions at Whole Foods Market. You adhered strictly to your food budget and successfully redirected excess surplus toward your Emergency Fund. No fraudulent anomalies were observed.
        </p>
      </div>
    </div>
  );
}
