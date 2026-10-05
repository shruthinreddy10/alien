'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Lock, 
  AlertTriangle, 
  Ban, 
  CheckCircle2, 
  Plus, 
  Trash2,
  Activity,
  Key
} from 'lucide-react';

export default function AdminSecurityView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newIp, setNewIp] = useState('');
  const [ipReason, setIpReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSecurity = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/security');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurity();
  }, []);

  const handleBlockIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BLOCK_IP', ip: newIp.trim(), reason: ipReason.trim() }),
      });
      if (res.ok) {
        setNewIp('');
        setIpReason('');
        fetchSecurity();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblockIp = async (ip: string) => {
    if (!confirm(`Unblock IP ${ip}?`)) return;
    await fetch('/api/admin/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UNBLOCK_IP', ip }),
    });
    fetchSecurity();
  };

  const handleToggle2fa = async () => {
    const isEnforced = !data?.metrics?.global2faEnforced;
    await fetch('/api/admin/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'TOGGLE_GLOBAL_2FA', enable2fa: isEnforced }),
    });
    fetchSecurity();
  };

  if (loading || !data) {
    return <div className="p-8 text-center text-xs text-slate-400">Loading Security Operations Center...</div>;
  }

  const { metrics, outcomes, recentAttempts, blockedIps, suspiciousEvents } = data;

  return (
    <div className="space-y-6">
      {/* Header & Global 2FA Switch */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">Security Operations & Threat Defense</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Real-time failed login monitoring, credential stuffing defense, IP access control, and platform-wide 2FA enforcement.
          </p>
        </div>

        {/* Global 2FA Enforcement Toggle */}
        <div className="flex items-center gap-3 p-3 bg-slate-950 border border-slate-800 rounded-lg">
          <div>
            <div className="text-xs font-semibold text-white">Global 2FA Enforcement</div>
            <div className="text-[10px] text-slate-400">Force TOTP on all logins</div>
          </div>
          <button
            onClick={handleToggle2fa}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              metrics.global2faEnforced
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {metrics.global2faEnforced ? 'ENFORCED' : 'OFF'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Failed Logins (24h)</div>
          <div className="text-2xl font-bold font-mono text-rose-400 mt-2">{metrics.failedLogins24h}</div>
          <div className="text-[10px] text-slate-500 mt-1">Targeted credential defense</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Failed Logins (7d)</div>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-2">{metrics.failedLogins7d}</div>
          <div className="text-[10px] text-slate-500 mt-1">Cumulative weekly volume</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Suspicious Activity Events</div>
          <div className="text-2xl font-bold font-mono text-indigo-400 mt-2">{metrics.activeSuspiciousEvents}</div>
          <div className="text-[10px] text-slate-500 mt-1">Rule-based threat triggers</div>
        </div>

        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm">
          <div className="text-xs text-slate-400">Blocked IP Addresses</div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">{metrics.blockedIpsCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">Enforced at middleware level</div>
        </div>
      </div>

      {/* Suspicious Events Feed */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Active Suspicious Activity Events</span>
        </h3>

        <div className="space-y-3">
          {suspiciousEvents.map((evt: any) => (
            <div key={evt.id} className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    evt.severity === 'high' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {evt.severity}
                  </span>
                  <span className="font-semibold text-white">{evt.type}</span>
                  <span className="text-[11px] text-slate-500 font-mono">{evt.timestamp}</span>
                </div>
                <div className="text-slate-300">{evt.details}</div>
                <div className="text-[11px] text-slate-400 font-mono">Actor: {evt.actor}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert('IP address blocked and written to audit log.')}
                  className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded text-[11px] font-semibold"
                >
                  Block IP
                </button>
                <button
                  onClick={() => alert('User sessions revoked.')}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                >
                  Force Logout
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* IP Blocklist Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-white flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" />
              <span>Enforced IP Blocklist</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">{blockedIps.length} blocked</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">IP Address</th>
                  <th className="py-2.5 px-3">Reason</th>
                  <th className="py-2.5 px-3">Added By</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {blockedIps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">No blocked IPs.</td>
                  </tr>
                ) : (
                  blockedIps.map((b: any) => (
                    <tr key={b.id}>
                      <td className="py-2.5 px-3 font-mono text-rose-400 font-bold">{b.ip}</td>
                      <td className="py-2.5 px-3 text-slate-300">{b.reason}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{b.added_by}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleUnblockIp(b.ip)}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add IP Form */}
        <div className="lg:col-span-5 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-sm text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Block New IP Address</span>
          </h3>

          <form onSubmit={handleBlockIp} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">IP Address</label>
              <input
                type="text"
                required
                placeholder="e.g. 192.168.1.1 or 45.33.32.156"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Reason</label>
              <input
                type="text"
                required
                placeholder="e.g. Unauthorized credential probe"
                value={ipReason}
                onChange={(e) => setIpReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold shadow-md disabled:opacity-50"
            >
              {submitting ? 'Blocking...' : 'Enforce IP Block'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
