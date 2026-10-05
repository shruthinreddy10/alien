'use client';

import React, { useState, useEffect } from 'react';
import { 
  FolderTree, 
  Repeat, 
  CreditCard, 
  Smartphone, 
  Lock, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { formatCents, parseToCents } from '@/lib/money';

interface SettingsViewsProps {
  subTab: 'categories' | 'recurring' | 'subscriptions' | 'sessions' | 'security';
}

export default function SettingsViews({ subTab }: SettingsViewsProps) {
  // Categories state
  const [categories, setCategories] = useState<any[]>([]);
  const [catName, setCatName] = useState('');
  const [catColor, setCatColor] = useState('#3B82F6');

  // Recurring state
  const [recurringRules, setRecurringRules] = useState<any[]>([]);
  const [recMerchant, setRecMerchant] = useState('');
  const [recAmountStr, setRecAmountStr] = useState('');

  // Subscriptions state
  const [subs, setSubs] = useState<any[]>([]);

  // Sessions state
  const [sessions, setSessions] = useState<any[]>([]);

  // 2FA state
  const [twoFactorData, setTwoFactorData] = useState<any>(null);
  const [totpCode, setTotpCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [securityMsg, setSecurityMsg] = useState('');

  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (subTab === 'categories') {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const json = await res.json();
          setCategories(json.categories || []);
        }
      } else if (subTab === 'recurring') {
        const res = await fetch('/api/recurring');
        if (res.ok) {
          const json = await res.json();
          setRecurringRules(json.rules || []);
        }
      } else if (subTab === 'subscriptions') {
        const res = await fetch('/api/subscriptions');
        if (res.ok) {
          const json = await res.json();
          setSubs(json.subscriptions || []);
        }
      } else if (subTab === 'sessions') {
        const res = await fetch('/api/sessions');
        if (res.ok) {
          const json = await res.json();
          setSessions(json.sessions || []);
        }
      } else if (subTab === 'security') {
        const res = await fetch('/api/settings/security');
        if (res.ok) {
          const json = await res.json();
          setTwoFactorData(json);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [subTab]);

  // Handle Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: catName.trim(), color: catColor, icon: 'Folder' }),
    });
    setCatName('');
    fetchData();
  };

  // Handle Create Recurring Rule
  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const cents = parseToCents(recAmountStr);
    if (!recMerchant.trim() || cents <= 0) return;
    await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant: recMerchant.trim(),
        amountMinor: cents,
        categoryId: 'cat_utilities',
        cadence: 'MONTHLY',
      }),
    });
    setRecMerchant('');
    setRecAmountStr('');
    fetchData();
  };

  // Handle Revoke Session
  const handleRevokeSession = async (sessionId: string) => {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REVOKE_ONE', sessionId }),
    });
    fetchData();
  };

  const handleRevokeAllOthers = async () => {
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REVOKE_ALL_OTHERS' }),
    });
    fetchData();
  };

  // Handle 2FA
  const handleEnable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg('');
    const res = await fetch('/api/settings/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ENABLE_2FA', code: totpCode }),
    });
    const json = await res.json();
    if (res.ok) {
      setSecurityMsg(json.message);
      fetchData();
    } else {
      setSecurityMsg(`Error: ${json.error}`);
    }
  };

  const handleDisable2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityMsg('');
    const res = await fetch('/api/settings/security', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DISABLE_2FA', password: disablePassword }),
    });
    const json = await res.json();
    if (res.ok) {
      setSecurityMsg(json.message);
      setDisablePassword('');
      fetchData();
    } else {
      setSecurityMsg(`Error: ${json.error}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 2.1 Categories View */}
      {subTab === 'categories' && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-400" />
                <span>Financial Category Manager</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Manage system defaults and personalized expenditure categories.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-white mb-4">Configured Categories</h3>
              <div className="divide-y divide-slate-800">
                {categories.map((c) => (
                  <div key={c.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="font-semibold text-white">{c.name}</span>
                      {c.is_system === 1 ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">System</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-400 font-mono">Custom</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-white">Create Custom Category</h3>
              <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pet Care, Gaming"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Color Tag</label>
                  <input
                    type="color"
                    value={catColor}
                    onChange={(e) => setCatColor(e.target.value)}
                    className="w-full h-9 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold">
                  Save Category
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2.3 Recurring Transactions */}
      {subTab === 'recurring' && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Repeat className="w-5 h-5 text-indigo-400" />
                <span>Automated Recurring Transactions</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Scheduled recurring rules that automatically populate your transaction ledger.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm">
              <div className="divide-y divide-slate-800">
                {recurringRules.map((r) => (
                  <div key={r.id} className="py-3.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold text-white">{r.merchant}</div>
                      <div className="text-[11px] text-slate-400 font-mono">Cadence: {r.cadence} &bull; Next: {r.next_run_at}</div>
                    </div>
                    <div className="font-mono font-bold text-white">{formatCents(r.amount_minor)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-4 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-white">Create Recurring Rule</h3>
              <form onSubmit={handleCreateRecurring} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Merchant / Recipient</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Electric Bill, Rent"
                    value={recMerchant}
                    onChange={(e) => setRecMerchant(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={recAmountStr}
                    onChange={(e) => setRecAmountStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold">
                  Add Recurring Rule
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 2.4 Subscription Detector */}
      {subTab === 'subscriptions' && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                <span>Detected Recurring Subscriptions</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Autonomous 90-day transaction analysis identifying recurring service subscriptions.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {subs.map((s) => (
              <div key={s.id} className="border border-slate-800 bg-slate-900/90 rounded-xl p-5 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-white">{s.merchant}</h3>
                  <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">Active</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{formatCents(s.amount_minor)}</div>
                <div className="text-[11px] text-slate-400 font-mono">Next charge: {s.next_charge_at}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2.9 Active Sessions */}
      {subTab === 'sessions' && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-indigo-400" />
                <span>Active Login Sessions</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Review active authorized devices and revoke suspect sessions with a single click.</p>
            </div>
            <button
              onClick={handleRevokeAllOthers}
              className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-semibold"
            >
              Revoke All Other Sessions
            </button>
          </div>

          <div className="border border-slate-800 bg-slate-900/90 rounded-xl overflow-hidden shadow-sm">
            <div className="divide-y divide-slate-800">
              {sessions.map((sess) => (
                <div key={sess.id} className="p-4 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-white">{sess.device_label}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      IP: {sess.ip_address} &bull; Location: {sess.location || 'Local'} &bull; Last seen: {sess.last_seen.slice(0, 16).replace('T', ' ')}
                    </div>
                  </div>
                  {sess.revoked_at ? (
                    <span className="text-rose-400 font-mono text-[11px]">Revoked</span>
                  ) : (
                    <button
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px]"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2.10 2FA Setup */}
      {subTab === 'security' && (
        <div className="space-y-6">
          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <span>Two-Factor Authentication (2FA / TOTP)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Enforce time-based one-time password protection across all login attempts.</p>
            </div>
            <div className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
              twoFactorData?.twoFactorEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
            }`}>
              {twoFactorData?.twoFactorEnabled ? '2FA ENABLED' : '2FA DISABLED'}
            </div>
          </div>

          {securityMsg && (
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-amber-400 font-mono">
              {securityMsg}
            </div>
          )}

          {!twoFactorData?.twoFactorEnabled ? (
            <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-white">Enable Authenticator App (Google Authenticator / Authy)</h3>
              <p className="text-xs text-slate-400">
                Secret Seed: <code className="bg-slate-950 px-2 py-1 rounded text-emerald-400 font-mono font-bold">{twoFactorData?.secret}</code>
              </p>

              <form onSubmit={handleEnable2fa} className="space-y-3 max-w-sm text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Enter 6-digit verification code from app:</label>
                  <input
                    type="text"
                    required
                    placeholder="000000"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono text-base tracking-widest text-center"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold">
                  Verify & Activate 2FA
                </button>
              </form>

              <div className="pt-4 border-t border-slate-800">
                <h4 className="text-xs font-semibold text-white mb-2">Emergency Recovery Codes:</h4>
                <div className="grid grid-cols-2 gap-2 max-w-sm font-mono text-[11px] text-slate-400">
                  {twoFactorData?.recoveryCodes?.map((code: string) => (
                    <div key={code} className="p-1.5 bg-slate-950 rounded text-center">{code}</div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-semibold text-sm text-white">Disable Two-Factor Authentication</h3>
              <form onSubmit={handleDisable2fa} className="space-y-3 max-w-sm text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Account Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
                <button type="submit" className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold">
                  Disable 2FA
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
