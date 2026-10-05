'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  X,
  CreditCard,
  Banknote,
  Landmark,
  Coins
} from 'lucide-react';
import { formatCents, parseToCents } from '@/lib/money';

interface Transaction {
  id: string;
  category_id: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  date: string;
  payment_method: string;
  notes: string | null;
  category_name: string | null;
  category_color: string | null;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface TransactionsViewProps {
  categories: Category[];
  onRefreshDashboard: () => void;
  openAddModal: boolean;
  onCloseAddModal: () => void;
}

export default function TransactionsView({
  categories,
  onRefreshDashboard,
  openAddModal,
  onCloseAddModal,
}: TransactionsViewProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  // Editing state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Form Modal State (for both Add and Edit)
  const isModalOpen = openAddModal || !!editingTx;
  const [formDescription, setFormDescription] = useState('');
  const [formAmountStr, setFormAmountStr] = useState('');
  const [formType, setFormType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formMethod, setFormMethod] = useState<'Card' | 'Bank' | 'Cash' | 'Crypto'>('Card');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (editingTx) {
      setFormDescription(editingTx.description);
      setFormAmountStr((editingTx.amount / 100).toFixed(2));
      setFormType(editingTx.type);
      setFormCategoryId(editingTx.category_id);
      setFormDate(editingTx.date);
      setFormMethod(editingTx.payment_method as any);
      setFormNotes(editingTx.notes || '');
      setFormError('');
    } else if (openAddModal) {
      setFormDescription('');
      setFormAmountStr('');
      setFormType('EXPENSE');
      setFormCategoryId(categories[0]?.id || '');
      setFormDate(new Date().toISOString().slice(0, 10));
      setFormMethod('Card');
      setFormNotes('');
      setFormError('');
    }
  }, [editingTx, openAddModal, categories]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (search) params.set('search', search);
      if (type !== 'ALL') params.set('type', type);
      if (category) params.set('category', category);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (minAmount) params.set('minAmount', parseToCents(minAmount).toString());
      if (maxAmount) params.set('maxAmount', parseToCents(maxAmount).toString());

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data || []);
        setTotalCount(json.pagination.total || 0);
        setTotalPages(json.pagination.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to fetch transactions:', e);
    } finally {
      setLoading(false);
    }
  }, [page, search, type, category, startDate, endDate, minAmount, maxAmount]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cents = parseToCents(formAmountStr);
    if (cents <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }
    if (!formDescription.trim()) {
      setFormError('Description is required.');
      return;
    }
    if (!formCategoryId) {
      setFormError('Please select a category.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        description: formDescription.trim(),
        amount: cents, // Stored strictly in integer minor units
        type: formType,
        categoryId: formCategoryId,
        date: formDate,
        paymentMethod: formMethod,
        notes: formNotes.trim() || null,
      };

      const url = editingTx ? `/api/transactions/${editingTx.id}` : '/api/transactions';
      const method = editingTx ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json();
        setFormError(errJson.error || 'Failed to save transaction.');
      } else {
        closeModal();
        fetchTransactions();
        onRefreshDashboard();
      }
    } catch (err: unknown) {
      setFormError('Network error. Failed to save transaction.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction record?')) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTransactions();
        onRefreshDashboard();
      } else {
        alert('Failed to delete transaction.');
      }
    } catch {
      alert('Network error deleting transaction.');
    }
  };

  const closeModal = () => {
    setEditingTx(null);
    onCloseAddModal();
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'Bank': return <Landmark className="w-3.5 h-3.5 text-blue-400" />;
      case 'Cash': return <Banknote className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Crypto': return <Coins className="w-3.5 h-3.5 text-amber-400" />;
      default: return <CreditCard className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Header */}
      <div className="glass-panel p-5 rounded-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search descriptions, notes..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Quick Type Select */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 p-1 rounded-xl">
            {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  type === t
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-Filter Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/5 text-xs">
          {/* Category Filter */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reset Filters */}
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearch('');
                setType('ALL');
                setCategory('');
                setStartDate('');
                setEndDate('');
                setMinAmount('');
                setMaxAmount('');
                setPage(1);
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-medium transition-all text-center"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Showing <span className="text-white font-semibold">{transactions.length}</span> of{' '}
            <span className="text-white font-semibold">{totalCount}</span> entries
          </div>
          <div className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Row-Level Scoped
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.02] text-slate-400 border-b border-white/5 font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Loading verified transactions...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    No transactions match your criteria.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400">{tx.date}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">{tx.description}</div>
                      {tx.notes && <div className="text-[10px] text-slate-400">{tx.notes}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{
                          backgroundColor: `${tx.category_color || '#6366F1'}20`,
                          color: tx.category_color || '#818CF8',
                        }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: tx.category_color || '#6366F1' }}
                        />
                        {tx.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                        {getMethodIcon(tx.payment_method)}
                        <span>{tx.payment_method}</span>
                      </div>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-200'
                      }`}
                    >
                      {tx.type === 'INCOME' ? '+' : '-'}
                      {formatCents(tx.amount)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingTx(tx)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-indigo-400 transition-colors"
                          title="Edit transaction"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(tx.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Transaction Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="font-bold text-sm text-white">
                {editingTx ? 'Edit Transaction' : 'Record New Transaction'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-white/5 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormType('EXPENSE')}
                  className={`py-2 rounded-lg font-semibold transition-all ${
                    formType === 'EXPENSE'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Expense (-)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('INCOME')}
                  className={`py-2 rounded-lg font-semibold transition-all ${
                    formType === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Income (+)
                </button>
              </div>

              {/* Amount (converted to integer minor units) */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={formAmountStr}
                  onChange={(e) => setFormAmountStr(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Stored as exact integer cents ({parseToCents(formAmountStr)} minor units)
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Whole Foods Market, Salary, Rent"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Category</label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="" disabled>Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                  >
                  </input>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Payment Method</label>
                <select
                  value={formMethod}
                  onChange={(e) => setFormMethod(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Card" className="bg-slate-900 text-white">Credit / Debit Card</option>
                  <option value="Bank" className="bg-slate-900 text-white">Bank Wire / ACH</option>
                  <option value="Cash" className="bg-slate-900 text-white">Cash</option>
                  <option value="Crypto" className="bg-slate-900 text-white">Crypto / Stablecoin</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Additional context or receipt info"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingTx ? 'Update Entry' : 'Record Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
