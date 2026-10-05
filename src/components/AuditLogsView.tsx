'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  History, 
  Link as LinkIcon, 
  AlertOctagon, 
  CheckCircle2, 
  Users, 
  Lock,
  RefreshCw
} from 'lucide-react';

interface AuditLog {
  id: string;
  user_id: string | null;
  user_email?: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  ip_address: string | null;
  prev_hash: string;
  hash: string;
  created_at: string;
}

interface VerificationStatus {
  isValid: boolean;
  totalEntries: number;
  brokenAtId?: string;
}

interface AuditLogsViewProps {
  isAdmin: boolean;
}

export default function AuditLogsView({ isAdmin }: AuditLogsViewProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [verification, setVerification] = useState<VerificationStatus | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; role: string; transaction_count: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [logsRes, usersRes] = await Promise.all([
          fetch('/api/admin/audit-logs'),
          fetch('/api/admin/users'),
        ]);

        if (logsRes.ok) {
          const lJson = await logsRes.json();
          setLogs(lJson.logs || []);
          setVerification(lJson.cryptographicVerification || null);
        }
        if (usersRes.ok) {
          const uJson = await usersRes.json();
          setUsers(uJson.users || []);
        }
      } else {
        // Non-admin can check health audit status
        const hRes = await fetch('/api/health');
        if (hRes.ok) {
          const hJson = await hRes.json();
          setVerification({
            isValid: hJson.security.auditChainStatus === 'VERIFIED_VALID',
            totalEntries: hJson.security.totalAuditEntries,
          });
        }
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [isAdmin]);

  return (
    <div className="space-y-6">
      {/* Integrity Verification Banner */}
      <div className="border border-emerald-500/20 bg-slate-900/90 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-base text-white">Cryptographic Audit Ledger</h2>
              {verification?.isValid ? (
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  CHAIN VERIFIED
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold font-mono">
                  <AlertOctagon className="w-3 h-3" />
                  TAMPER DETECTED
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Every system event computes <code>hash = SHA-256(prevHash + timestamp + payload)</code>, preventing retrospective data tampering.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <div className="text-slate-400">Total Chained Records</div>
            <div className="text-white font-bold text-sm">{verification?.totalEntries || logs.length}</div>
          </div>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Re-verify audit ledger"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Admin Users Overview (If Admin) */}
      {isAdmin && (
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-sm text-white">Platform Users & Account Scopes</h3>
            </div>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Raw Financial Data Redacted
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-right">Transactions</th>
                  <th className="py-2.5 px-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{u.id}</td>
                    <td className="py-2.5 px-3 font-medium">{u.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-300">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] ${u.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono">{u.transaction_count} records</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{u.created_at.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Log Entries Table */}
      {isAdmin ? (
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-sm text-white">Chained Audit Trail</h3>
            </div>
            <span className="text-xs text-slate-400">Showing last 100 cryptographic entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">Cryptographic Hash Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200 font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      Loading audit chain records...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-500">
                      No audit records found.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-400">
                        {log.created_at.replace('T', ' ').slice(0, 19)}
                      </td>
                      <td className="py-3 px-4 font-sans font-semibold">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-emerald-400 border border-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {log.user_email || log.user_id || 'SYSTEM'}
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 12)}...)` : ''}
                      </td>
                      <td className="py-3 px-4 space-y-0.5">
                        <div className="flex items-center gap-1.5 text-slate-400" title={`Current Hash: ${log.hash}`}>
                          <span className="text-[10px] text-slate-500">hash:</span>
                          <span className="text-emerald-400">{log.hash.slice(0, 16)}...</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500 text-[10px]" title={`Previous Hash: ${log.prev_hash}`}>
                          <LinkIcon className="w-2.5 h-2.5" />
                          <span>prev: {log.prev_hash.slice(0, 16)}...</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-8 text-center space-y-4 shadow-sm">
          <History className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="font-bold text-base text-white">Tamper-Evident Ledger Active</h3>
          <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
            All your transactions, budget changes, exports, and AI assistant inquiries are autonomously recorded into an immutable, SHA-256 hash-chained audit ledger. To inspect the full multi-tenant system ledger, sign in with the <strong>Security Admin</strong> account (<code>admin@demo.com</code>).
          </p>
        </div>
      )}
    </div>
  );
}
