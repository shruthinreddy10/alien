'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Shield, 
  ShieldAlert, 
  Key, 
  LogOut, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Lock,
  X,
  AlertTriangle
} from 'lucide-react';

export default function AdminUsersView() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Destructive modal state
  const [actionModal, setActionModal] = useState<{
    action: string;
    user: any;
  } | null>(null);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setUsers(json.users || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, statusFilter]);

  const handleAction = async () => {
    if (!actionModal) return;
    setSubmitting(true);
    setMsg('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionModal.action,
          userId: actionModal.user.id,
          targetEmail: confirmEmail,
          reason,
          newRole: actionModal.action === 'PROMOTE_ADMIN' ? 'ADMIN' : 'USER',
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setMsg(json.message || 'Action executed successfully.');
        fetchUsers();
        setTimeout(() => {
          setActionModal(null);
          setConfirmEmail('');
          setReason('');
          setMsg('');
        }, 1200);
      } else {
        setMsg(`Error: ${json.error}`);
      }
    } catch (e) {
      setMsg('Network error executing action.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold tracking-tight text-white">User Account Governance</h2>
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono font-semibold">
              Admin Only
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manage roles, suspend accounts, revoke active sessions, and review audit history. Raw financial ledgers remain redacted.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 text-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
        >
          <option value="">All Roles</option>
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="SUSPENDED">SUSPENDED</option>
        </select>
      </div>

      {/* Users Table */}
      <div className="border border-slate-800 bg-slate-900/90 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Sessions</th>
                <th className="py-3 px-4">Transactions</th>
                <th className="py-3 px-4">Registered</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">Loading user accounts...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white cursor-pointer hover:text-amber-400" onClick={() => setSelectedUser(u)}>
                        {u.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                        u.role === 'ADMIN' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {u.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {u.active_sessions_count || 1} active
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {u.transaction_count} entries
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {u.created_at.slice(0, 10)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setActionModal({ action: 'FORCE_LOGOUT', user: u })}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
                          title="Force revoke sessions"
                        >
                          Revoke
                        </button>
                        <button
                          onClick={() => setActionModal({ action: 'TOGGLE_STATUS', user: u })}
                          className={`px-2 py-1 rounded text-[11px] font-semibold ${
                            u.status === 'ACTIVE' ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Detail Drawer Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm text-white">User Governance Profile</h3>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-950 rounded-lg space-y-1">
                <div className="text-slate-400">Account Details:</div>
                <div className="font-bold text-white text-sm">{selectedUser.name}</div>
                <div className="font-mono text-slate-300">{selectedUser.email} &bull; ID: {selectedUser.id}</div>
                <div className="text-slate-400 pt-1">Total Ledger Entries: <strong className="text-white">{selectedUser.transaction_count}</strong> (Raw rows isolated by RLS)</div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                {selectedUser.role === 'USER' ? (
                  <button
                    onClick={() => {
                      setActionModal({ action: 'CHANGE_ROLE', user: selectedUser });
                    }}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-semibold"
                  >
                    Promote to Admin
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setActionModal({ action: 'CHANGE_ROLE', user: selectedUser });
                    }}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-semibold"
                  >
                    Demote to User
                  </button>
                )}

                <button
                  onClick={() => setActionModal({ action: 'FORCE_RESET_PASSWORD', user: selectedUser })}
                  className="px-3 py-2 bg-indigo-600/30 hover:bg-indigo-600/40 border border-indigo-500/40 text-indigo-300 rounded-lg font-semibold"
                >
                  Force Password Reset
                </button>

                <button
                  onClick={() => setActionModal({ action: 'SOFT_DELETE', user: selectedUser })}
                  className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 rounded-lg font-semibold"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-sm text-white">Confirm Admin Action</h3>
              <button onClick={() => setActionModal(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2">
              <p>Action: <strong className="text-amber-400">{actionModal.action}</strong> on <strong>{actionModal.user.email}</strong></p>
              
              {actionModal.action === 'SOFT_DELETE' && (
                <div>
                  <label className="block text-slate-400 mb-1">Type user email to confirm destruction:</label>
                  <input
                    type="text"
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder={actionModal.user.email}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Reason for Audit Log:</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Inactivity, security alert, user request"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white"
                />
              </div>

              {msg && <div className="p-2.5 rounded bg-slate-950 text-amber-400 font-mono text-[11px]">{msg}</div>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setActionModal(null)} className="px-3 py-2 bg-slate-800 rounded-lg text-slate-300">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={submitting || (actionModal.action === 'SOFT_DELETE' && confirmEmail !== actionModal.user.email)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white rounded-lg font-semibold"
              >
                {submitting ? 'Executing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
