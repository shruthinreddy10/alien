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
  AlertTriangle,
  Edit2,
  Undo2,
  X,
  Shield
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
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Category Deletion Modal state per 13.2 specification
  const [deleteModalCategory, setDeleteModalCategory] = useState<any | null>(null);
  const [deleteAction, setDeleteAction] = useState<'reassign' | 'uncategorized' | 'delete_all'>('reassign');
  const [reassignTargetId, setReassignTargetId] = useState<string>('');
  const [deleteBudgetChecked, setDeleteBudgetChecked] = useState<boolean>(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);

  // Category Undo Toast (30s countdown window)
  const [undoToast, setUndoToast] = useState<{
    id: string;
    message: string;
    secondsLeft: number;
  } | null>(null);

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

  // Live 30-Second Undo Timer Countdown per 13.2 specification
  useEffect(() => {
    if (!undoToast) return;
    if (undoToast.secondsLeft <= 0) {
      setUndoToast(null);
      return;
    }
    const timer = setInterval(() => {
      setUndoToast((prev) => {
        if (!prev) return null;
        if (prev.secondsLeft <= 1) return null;
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [undoToast]);

  // Handle Create or Edit Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    if (editingCategory) {
      // Edit existing
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName.trim(), color: catColor, icon: 'Folder' }),
      });
      setEditingCategory(null);
    } else {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: catName.trim(), color: catColor, icon: 'Folder' }),
      });
    }
    setCatName('');
    setCatColor('#3B82F6');
    fetchData();
  };

  // Handle Category Deletion Flow per 13.2 specification
  const handleInitiateDelete = (category: any) => {
    if (category.is_system === 1) {
      alert('System categories cannot be deleted.');
      return;
    }

    const txCount = category.transaction_count || 0;
    // If 0 transactions: instant delete
    if (txCount === 0) {
      if (confirm(`Delete empty custom category "${category.name}"?`)) {
        executeDelete(category.id, { action: 'uncategorized' }, category.name);
      }
      return;
    }

    // If transactions > 0: open reassignment modal
    setDeleteModalCategory(category);
    setDeleteAction('reassign');
    const firstOther = categories.find((c) => c.id !== category.id);
    setReassignTargetId(firstOther ? firstOther.id : 'cat_uncategorized');
    setDeleteBudgetChecked(!!category.budget_id);
  };

  const executeDelete = async (categoryId: string, options: any, categoryName: string) => {
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      if (res.ok) {
        setDeleteModalCategory(null);
        setUndoToast({
          id: categoryId,
          message: data.message || `"${categoryName}" deleted.`,
          secondsLeft: 30,
        });
        fetchData();
      } else {
        alert(data.error || 'Failed to delete category');
      }
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const handleConfirmModalDelete = async () => {
    if (!deleteModalCategory) return;
    await executeDelete(
      deleteModalCategory.id,
      {
        action: deleteAction,
        reassign_to: deleteAction === 'reassign' ? reassignTargetId : undefined,
        delete_budget: deleteBudgetChecked,
      },
      deleteModalCategory.name
    );
  };

  const handleUndo = async (undoId: string) => {
    try {
      const res = await fetch(`/api/categories/${undoId}/undo`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok) {
        setUndoToast(null);
        fetchData();
      } else {
        alert(data.error || 'Undo window expired or failed.');
      }
    } catch {
      alert('Network error during undo.');
    }
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
      {/* 2.1 Categories View per 13.2 specification */}
      {subTab === 'categories' && (
        <div className="space-y-6">
          {/* Toast Notification with Live 30s Undo Window */}
          {undoToast && (
            <div className="sticky top-4 z-40 p-4 bg-slate-900 border border-indigo-500/50 shadow-xl shadow-indigo-950/40 rounded-xl flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold font-mono text-xs">
                  {undoToast.secondsLeft}s
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{undoToast.message}</div>
                  <div className="text-[11px] text-slate-400">
                    Undo window active. You can restore this category and all its transactions within {undoToast.secondsLeft} seconds.
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleUndo(undoToast.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-md transition-all"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>Undo ({undoToast.secondsLeft}s)</span>
                </button>
                <button
                  onClick={() => setUndoToast(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <FolderTree className="w-5 h-5 text-indigo-400" />
                <span>Financial Category Manager</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Manage system defaults and personalized custom categories with transaction reassignment.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              {/* SECTION 1: Your Categories (Editable & Deletable) */}
              <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Your Categories</h3>
                    <p className="text-xs text-slate-400">Custom personalized expenditure tags created by your account</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] bg-indigo-500/20 text-indigo-400 font-mono">
                    {categories.filter((c) => c.is_system === 0).length} Custom
                  </span>
                </div>

                <div className="divide-y divide-slate-800">
                  {categories.filter((c) => c.is_system === 0).length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                      No custom categories configured yet. Create one on the right!
                    </div>
                  ) : (
                    categories
                      .filter((c) => c.is_system === 0)
                      .map((c) => (
                        <div key={c.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                          <div className="flex items-center gap-3">
                            <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                            <div>
                              <div className="font-semibold text-white flex items-center gap-2">
                                <span>{c.name}</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800 text-slate-300 font-mono">
                                  {c.transaction_count || 0} {c.transaction_count === 1 ? 'transaction' : 'transactions'}
                                </span>
                              </div>
                              {c.budget_amount && (
                                <div className="text-[11px] text-amber-400 font-mono mt-0.5">
                                  Budget: {formatCents(c.budget_amount)}/month
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => {
                                setEditingCategory(c);
                                setCatName(c.name);
                                setCatColor(c.color);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="Edit Category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleInitiateDelete(c)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors"
                              title={`Delete ${c.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* SECTION 2: System Categories (Read-Only) */}
              <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <span>System Categories</span>
                    </h3>
                    <p className="text-xs text-slate-400">Core standard classification defaults (Read-only)</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                    Protected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories
                    .filter((c) => c.is_system === 1)
                    .map((c) => (
                      <div
                        key={c.id}
                        className="p-3 bg-slate-950/70 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="font-medium text-slate-200">{c.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {c.transaction_count || 0} txns
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Right Form: Create / Edit Category */}
            <div className="lg:col-span-4 border border-slate-800 bg-slate-900/90 rounded-xl p-6 shadow-sm space-y-4 self-start">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">
                  {editingCategory ? `Edit "${editingCategory.name}"` : 'Create Custom Category'}
                </h3>
                {editingCategory && (
                  <button
                    onClick={() => {
                      setEditingCategory(null);
                      setCatName('');
                      setCatColor('#3B82F6');
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                )}
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-400 mb-1">Category Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pet Care, Gaming, Coffee"
                    value={catName}
                    onChange={(e) => setCatName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Color Tag</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                      className="w-12 h-9 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer p-0.5"
                    />
                    <span className="font-mono text-slate-400">{catColor}</span>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold shadow-md transition-all"
                >
                  {editingCategory ? 'Update Category' : 'Save Category'}
                </button>
              </form>
            </div>
          </div>

          {/* Category Deletion Reassignment Modal per 13.2 specification */}
          {deleteModalCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 rounded-2xl shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Delete &ldquo;{deleteModalCategory.name}&rdquo;</span>
                  </h3>
                  <button
                    onClick={() => setDeleteModalCategory(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Warning message */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-lg text-xs">
                  <strong>Warning:</strong> {deleteModalCategory.transaction_count || 0} transactions currently use this category.
                </div>

                {/* Radio options */}
                <div className="space-y-2 text-xs">
                  <label className="block text-slate-300 font-medium mb-1">Choose how to handle existing transactions:</label>

                  {/* Option A: Reassign */}
                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="reassign"
                      checked={deleteAction === 'reassign'}
                      onChange={() => setDeleteAction('reassign')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div className="w-full">
                      <span className="font-semibold text-white block">Reassign to another category</span>
                      <span className="text-[11px] text-slate-400 block mb-2">Move all existing transactions to a selected category.</span>
                      {deleteAction === 'reassign' && (
                        <select
                          value={reassignTargetId}
                          onChange={(e) => setReassignTargetId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
                        >
                          {categories
                            .filter((c) => c.id !== deleteModalCategory.id)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.is_system ? '(System)' : '(Custom)'}
                              </option>
                            ))}
                        </select>
                      )}
                    </div>
                  </label>

                  {/* Option B: Move to Uncategorized */}
                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="uncategorized"
                      checked={deleteAction === 'uncategorized'}
                      onChange={() => setDeleteAction('uncategorized')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <span className="font-semibold text-white block">Move to &ldquo;Uncategorized&rdquo;</span>
                      <span className="text-[11px] text-slate-400 block">Default system fallback for unsorted transactions.</span>
                    </div>
                  </label>

                  {/* Option C: Delete transactions too */}
                  <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700">
                    <input
                      type="radio"
                      name="deleteAction"
                      value="delete_all"
                      checked={deleteAction === 'delete_all'}
                      onChange={() => setDeleteAction('delete_all')}
                      className="mt-0.5 text-rose-500"
                    />
                    <div>
                      <span className="font-semibold text-rose-300 block">Delete transactions too</span>
                      <span className="text-[11px] text-slate-400 block">Soft-delete all associated transactions with 24h grace period.</span>
                    </div>
                  </label>
                </div>

                {/* Active Budget Warning & Checkbox */}
                {deleteModalCategory.budget_amount && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs space-y-2">
                    <div className="text-rose-300 font-medium">
                      ⚠️ This category has an active budget of {formatCents(deleteModalCategory.budget_amount)}/month.
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                      <input
                        type="checkbox"
                        checked={deleteBudgetChecked}
                        onChange={(e) => setDeleteBudgetChecked(e.target.checked)}
                        className="rounded border-slate-700 text-rose-600"
                      />
                      <span>Also delete this category budget</span>
                    </label>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDeleteModalCategory(null)}
                    disabled={deleteSubmitting}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmModalDelete}
                    disabled={deleteSubmitting}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold shadow-md shadow-rose-600/30 transition-all flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{deleteSubmitting ? 'Deleting...' : 'Delete Category'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
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
