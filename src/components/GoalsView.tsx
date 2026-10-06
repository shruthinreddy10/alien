'use client';

import React, { useState, useEffect } from 'react';
import { Target, Plus, CheckCircle2, TrendingUp, Calendar, X } from 'lucide-react';
import { formatINR, parseToPaise } from '@/lib/money';

export default function GoalsView() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [targetStr, setTargetStr] = useState('');
  const [currentStr, setCurrentStr] = useState('');
  const [deadline, setDeadline] = useState('');

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/goals');
      if (res.ok) {
        const json = await res.json();
        setGoals(json.goals || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const tMinor = parseToPaise(targetStr);
    const cMinor = parseToPaise(currentStr || '0');
    if (!name || tMinor <= 0) return;

    await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, targetMinor: tMinor, currentMinor: cMinor, deadline }),
    });

    setModalOpen(false);
    setName('');
    setTargetStr('');
    setCurrentStr('');
    setDeadline('');
    fetchGoals();
  };

  return (
    <div className="space-y-6">
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Savings Goals & Milestones</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Track multi-stage savings targets with integer minor-unit arithmetic and milestone progress celebrations.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md"
        >
          <Plus className="w-4 h-4" />
          <span>New Savings Goal</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-3 text-center py-8 text-xs text-slate-400">Loading savings goals...</div>
        ) : goals.length === 0 ? (
          <div className="col-span-3 border border-slate-800 bg-slate-900/90 rounded-xl p-12 text-center text-xs text-slate-400">
            No savings goals set up yet. Click "New Savings Goal" to start planning!
          </div>
        ) : (
          goals.map((g: any) => {
            const pct = Math.min(100, Math.round((g.current_minor / g.target_minor) * 100));
            return (
              <div key={g.id} className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">{g.name}</h3>
                  <span className="text-[11px] font-mono text-emerald-400 font-bold">{pct}%</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono text-slate-400">
                    <span className="tabular-nums">Saved: <strong className="text-white">{formatINR(g.current_minor)}</strong></span>
                    <span className="tabular-nums">Target: {formatINR(g.target_minor)}</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="h-full bg-emerald-500 rounded-full transition-all duration-500" />
                  </div>
                </div>

                {g.deadline && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Target Date: {g.deadline}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Create Savings Goal</h3>
              <button onClick={() => setModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Goal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. New Laptop, Emergency Fund"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Amount (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={targetStr}
                    onChange={(e) => setTargetStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Starting Amount (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-semibold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={currentStr}
                    onChange={(e) => setCurrentStr(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Target Deadline (Optional)</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-2 bg-slate-800 rounded-lg text-slate-300">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold">
                  Save Goal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
