'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  XCircle, 
  Filter, 
  RefreshCw, 
  ExternalLink, 
  PiggyBank, 
  Search,
  Calendar
} from 'lucide-react';
import { formatINR } from '@/lib/money';

interface AlertsViewProps {
  onNavigateTab?: (tab: string) => void;
}

export default function AlertsView({ onNavigateTab }: AlertsViewProps) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'unacknowledged' | 'acknowledged' | 'dismissed'>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Selected Transaction Modal
  const [selectedTxModal, setSelectedTxModal] = useState<any | null>(null);
  const [scanning, setScanning] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (ruleFilter !== 'all') params.set('rule', ruleFilter);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);

      const res = await fetch(`/api/alerts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.alerts || []);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, ruleFilter, startDate, endDate]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAction = async (id: string, action: 'ACKNOWLEDGE' | 'DISMISS') => {
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setFeedbackMsg(action === 'ACKNOWLEDGE' ? 'Alert acknowledged.' : 'Alert marked as normal.');
      setTimeout(() => setFeedbackMsg(''), 3000);
      fetchAlerts();
    }
  };

  const handleRunScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SCAN' }),
      });
      if (res.ok) {
        const json = await res.json();
        setFeedbackMsg(`Scan complete: ${json.newAnomalies || 0} new anomalies identified.`);
        setTimeout(() => setFeedbackMsg(''), 4000);
        fetchAlerts();
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Financial Anomaly Alerts & Warnings</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated heuristic detection monitoring 90-day averages, duplicate charges, and irregular spending patterns.
          </p>
        </div>

        <button
          onClick={handleRunScan}
          disabled={scanning}
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-slate-700 disabled:opacity-50 transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
          <span>{scanning ? 'Scanning Transactions...' : 'Run Anomaly Scan'}</span>
        </button>
      </div>

      {feedbackMsg && (
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Interactive Filters Row */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-4 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Filter className="w-3.5 h-3.5 text-indigo-400" />
          <span>Filters:</span>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1">
          <label className="text-slate-400 text-[11px]">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="unacknowledged">Unacknowledged</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="dismissed">Dismissed (Normal)</option>
          </select>
        </div>

        {/* Severity Filter */}
        <div className="flex items-center gap-1">
          <label className="text-slate-400 text-[11px]">Severity:</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </select>
        </div>

        {/* Rule Filter */}
        <div className="flex items-center gap-1">
          <label className="text-slate-400 text-[11px]">Rule:</label>
          <select
            value={ruleFilter}
            onChange={(e) => setRuleFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Detection Rules</option>
            <option value="amount_outlier">amount_outlier (&gt; 3x average)</option>
            <option value="first_merchant_high">first_merchant_high</option>
            <option value="duplicate_charge">duplicate_charge (within 24h)</option>
            <option value="unusual_time">unusual_time (2-5 AM)</option>
            <option value="category_spike">category_spike (&gt; 200% surge)</option>
          </select>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 text-[11px]">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
          />
          <label className="text-slate-400 text-[11px]">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-2 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs"
          />
        </div>

        {(statusFilter !== 'all' || severityFilter !== 'all' || ruleFilter !== 'all' || startDate || endDate) && (
          <button
            onClick={() => {
              setStatusFilter('all');
              setSeverityFilter('all');
              setRuleFilter('all');
              setStartDate('');
              setEndDate('');
            }}
            className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold ml-auto"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">
            <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mx-auto mb-2" />
            <span>Filtering and loading anomaly records...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-12 text-center text-xs text-slate-400">
            <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white">No Matching Anomaly Alerts</h3>
            <p className="mt-1">All accounts clear. No suspicious transactions or spending spikes match your filters.</p>
          </div>
        ) : (
          alerts.map((a: any) => {
            const isHigh = a.level === 'HIGH' || a.severity === 'high' || a.severity >= 0.7;
            const isMedium = a.level === 'MEDIUM' || a.severity === 'medium' || (a.severity >= 0.4 && a.severity < 0.7);

            return (
              <div 
                key={a.id} 
                className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-700 transition-colors"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                      isHigh
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : isMedium
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}>
                      {a.level || (isHigh ? 'HIGH' : isMedium ? 'MEDIUM' : 'LOW')} Severity
                    </span>
                    <span className="font-mono text-[11px] text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50">
                      Rule: {a.rule}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {a.created_at.slice(0, 10)}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-white flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>{a.title || a.rule}</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{a.description || a.details}</p>
                  </div>

                  {/* Joined Transaction Details */}
                  {a.transaction_amount !== null && (
                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-slate-400">Transaction:</span>
                      <span className="font-semibold text-white">{a.transaction_description || 'Unknown Merchant'}</span>
                      <span className="font-mono font-bold text-rose-400">
                        {formatINR(a.transaction_amount)}
                      </span>
                      {a.category_name && (
                        <span className="text-slate-400">
                          in <span className="text-slate-200">{a.category_name}</span>
                        </span>
                      )}
                      <span className="text-slate-500 font-mono text-[11px]">{a.transaction_date}</span>
                    </div>
                  )}

                  {/* Status Badges */}
                  <div className="flex items-center gap-3 pt-1">
                    {a.acknowledged_at && (
                      <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Acknowledged on {a.acknowledged_at.slice(0, 10)}
                      </span>
                    )}
                    {a.dismissed_at && (
                      <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" /> Marked as normal on {a.dismissed_at.slice(0, 10)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons per 13.1 UI: Acknowledge, Mark as normal, View txn, Create budget */}
                <div className="flex flex-wrap md:flex-col items-stretch md:items-end gap-2 shrink-0">
                  {!a.acknowledged_at && !a.dismissed_at && (
                    <button
                      onClick={() => handleAction(a.id, 'ACKNOWLEDGE')}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all text-center"
                    >
                      Acknowledge
                    </button>
                  )}
                  {!a.dismissed_at && (
                    <button
                      onClick={() => handleAction(a.id, 'DISMISS')}
                      className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs border border-slate-700 transition-all text-center"
                      title="Dismiss alert and audit log as expected normal behavior"
                    >
                      Mark as normal
                    </button>
                  )}

                  {a.transaction_id && (
                    <button
                      onClick={() => setSelectedTxModal(a)}
                      className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-300 rounded-lg text-xs border border-slate-800 flex items-center justify-center gap-1.5 text-center"
                    >
                      <ExternalLink className="w-3 h-3 text-indigo-400" />
                      <span>View Txn</span>
                    </button>
                  )}

                  <button
                    onClick={() => onNavigateTab ? onNavigateTab('budgets') : null}
                    className="px-3.5 py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs border border-slate-800 flex items-center justify-center gap-1.5 text-center"
                    title="Configure budget cap for this category"
                  >
                    <PiggyBank className="w-3 h-3 text-amber-400" />
                    <span>Create Budget</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* View Txn Modal */}
      {selectedTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Transaction & Anomaly Details</span>
              </h3>
              <button
                onClick={() => setSelectedTxModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
                <span className="text-slate-400 text-[11px] block">Merchant Description</span>
                <span className="text-sm font-semibold text-white block">
                  {selectedTxModal.transaction_description || 'Unknown'}
                </span>
                <div className="text-base font-mono font-bold text-rose-400 pt-1">
                  {formatINR(selectedTxModal.transaction_amount)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Date</span>
                  <span className="font-mono text-slate-200">{selectedTxModal.transaction_date}</span>
                </div>
                <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-500 block">Category</span>
                  <span className="text-slate-200">{selectedTxModal.category_name || 'General'}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1">
                <span className="font-semibold text-amber-400 text-[11px] block">
                  Heuristic Rule: {selectedTxModal.rule} ({selectedTxModal.level} Severity)
                </span>
                <p className="text-[11px] text-amber-300 leading-relaxed">
                  {selectedTxModal.description}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end gap-2 text-xs">
              <button
                onClick={() => setSelectedTxModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
