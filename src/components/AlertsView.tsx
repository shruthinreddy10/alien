'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';

export default function AlertsView() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const json = await res.json();
        setAlerts(json.alerts || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const handleAction = async (id: string, action: 'ACKNOWLEDGE' | 'DISMISS') => {
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    fetchAlerts();
  };

  return (
    <div className="space-y-6">
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Financial Anomaly Alerts & Warnings</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Automated heuristic detection flagging unusual expenditure spikes and duplicate merchant transactions.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-400">Scanning for financial anomalies...</div>
        ) : alerts.length === 0 ? (
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-12 text-center text-xs text-slate-400">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
            <span>All accounts clear. No suspicious transactions or spending anomalies detected!</span>
          </div>
        ) : (
          alerts.map((a: any) => (
            <div key={a.id} className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    a.severity === 'high' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {a.severity} Severity
                  </span>
                  <span className="font-bold text-xs text-white">{a.rule}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{a.created_at.slice(0, 10)}</span>
                </div>
                <p className="text-xs text-slate-300">{a.details}</p>
                {a.acknowledged_at && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Acknowledged on {a.acknowledged_at.slice(0, 10)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {!a.acknowledged_at && (
                  <button
                    onClick={() => handleAction(a.id, 'ACKNOWLEDGE')}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                  >
                    Acknowledge
                  </button>
                )}
                <button
                  onClick={() => handleAction(a.id, 'DISMISS')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg text-xs"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
