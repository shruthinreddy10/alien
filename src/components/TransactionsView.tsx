'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit3, 
  ChevronLeft, 
  ChevronRight, 
  X,
  CreditCard,
  Banknote,
  Landmark,
  Smartphone,
  Tag,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  UploadCloud,
  ExternalLink
} from 'lucide-react';
import { formatINR, parseToPaise } from '@/lib/money';

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
  attachment_url?: string | null;
  attachmentUrl?: string | null;
  anomaly_id?: string | null;
  anomaly_rule?: string | null;
  anomaly_level?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  anomaly_severity?: number | string | null;
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

// 2.6 Helper for merchant avatar / initials
function getMerchantInitials(name: string): { initials: string; bg: string } {
  const clean = name.trim();
  const words = clean.split(' ');
  const initials = words.length > 1 
    ? (words[0][0] + words[1][0]).toUpperCase()
    : clean.slice(0, 2).toUpperCase();

  // Consistent hash for background colors
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = clean.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#0F5132', '#1E3A8A', '#831843', '#701A75', '#365314', '#134E4A', '#7C2D12'
  ];
  const bg = colors[Math.abs(hash) % colors.length];

  return { initials, bg };
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

  // Quick Add Sheet State (opens as right-side sheet on desktop, bottom sheet on mobile)
  const isSheetOpen = openAddModal || !!editingTx;
  const [formDescription, setFormDescription] = useState('');
  const [formAmountStr, setFormAmountStr] = useState('');
  const [formType, setFormType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formMethod, setFormMethod] = useState<'UPI' | 'Credit Card' | 'Debit Card' | 'Net Banking' | 'Cash'>('UPI');
  const [formNotes, setFormNotes] = useState('');
  const [formUpiRef, setFormUpiRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Attachment upload state
  const [formAttachmentUrl, setFormAttachmentUrl] = useState('');
  const [formAttachmentName, setFormAttachmentName] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Populate form when editingTx changes
  useEffect(() => {
    if (editingTx) {
      setFormDescription(editingTx.description);
      setFormAmountStr((editingTx.amount / 100).toFixed(2));
      setFormType(editingTx.type);
      setFormCategoryId(editingTx.category_id);
      setFormDate(editingTx.date);
      setFormMethod((editingTx.payment_method as any) || 'UPI');
      setFormNotes(editingTx.notes || '');
      setFormUpiRef('');
      setFormAttachmentUrl(editingTx.attachment_url || editingTx.attachmentUrl || '');
      setFormAttachmentName(editingTx.attachment_url || editingTx.attachmentUrl ? 'Attached Document' : '');
      setUploadError('');
    } else {
      setFormDescription('');
      setFormAmountStr('');
      setFormType('EXPENSE');
      setFormCategoryId(categories[0]?.id || '');
      setFormDate(new Date().toISOString().slice(0, 10));
      setFormMethod('UPI');
      setFormNotes('');
      setFormUpiRef('');
      setFormAttachmentUrl('');
      setFormAttachmentName('');
      setUploadError('');
    }
  }, [editingTx, categories]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError('');
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type.toLowerCase())) {
      setUploadError('Invalid format. Please select PNG, JPEG, WebP, or PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File size exceeds the 10 MB limit.');
      return;
    }

    setUploadingAttachment(true);
    setFormAttachmentName(file.name);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/v1/transactions/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || 'Failed to upload attachment');
        setFormAttachmentUrl('');
        setFormAttachmentName('');
      } else {
        setFormAttachmentUrl(data.url);
      }
    } catch (err: any) {
      setUploadError(err.message || 'Network error during file upload');
      setFormAttachmentUrl('');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (search) params.set('search', search);
      if (type !== 'ALL') params.set('type', type);
      if (category) params.set('category', category);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (minAmount) params.set('minAmount', parseToPaise(minAmount).toString());
      if (maxAmount) params.set('maxAmount', parseToPaise(maxAmount).toString());

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.transactions || []);
        setTotalCount(json.pagination?.totalCount || 0);
        setTotalPages(json.pagination?.totalPages || 1);
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

  const handleSubmit = async (e?: React.FormEvent, addAnother = false) => {
    if (e) e.preventDefault();
    setFormError('');

    const amountMinor = parseToPaise(formAmountStr);
    if (amountMinor <= 0) {
      setFormError('Please enter a valid amount greater than ₹0.00');
      return;
    }

    if (!formCategoryId) {
      setFormError('Please select a valid category');
      return;
    }

    setSubmitting(true);
    try {
      const url = editingTx ? `/api/transactions/${editingTx.id}` : '/api/transactions';
      const method = editingTx ? 'PUT' : 'POST';

      const combinedNotes = formUpiRef 
        ? `${formNotes ? formNotes + ' | ' : ''}UPI Ref: ${formUpiRef}`
        : formNotes || null;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountMinor,
          type: formType,
          description: formDescription,
          categoryId: formCategoryId,
          date: formDate,
          paymentMethod: formMethod,
          notes: combinedNotes,
          attachmentUrl: formAttachmentUrl || null,
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        setFormError(json.error || 'Failed to save transaction');
        return;
      }

      fetchTransactions();
      onRefreshDashboard();

      if (addAnother) {
        setFormAmountStr('');
        setFormDescription('');
        setFormNotes('');
        setFormUpiRef('');
        setFormAttachmentUrl('');
        setFormAttachmentName('');
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        closeSheet();
      }
    } catch (err: any) {
      setFormError(err.message || 'An unexpected error occurred');
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
      alert('Network error while deleting transaction.');
    }
  };

  const closeSheet = () => {
    setEditingTx(null);
    setFormAttachmentUrl('');
    setFormAttachmentName('');
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onCloseAddModal();
  };

  const getMethodChip = (method: string) => {
    const isUPI = method?.toLowerCase().includes('upi');
    const isCard = method?.toLowerCase().includes('card');
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-white/5 text-[11px] font-mono text-slate-300">
        {isUPI ? <Smartphone className="w-3 h-3 text-emerald-400" /> : isCard ? <CreditCard className="w-3 h-3 text-blue-400" /> : <Banknote className="w-3 h-3 text-amber-400" />}
        <span>{method}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Add CTA */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-white">Financial Ledger</h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
              ROW-LEVEL SCOPED
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {totalCount} total records logged. All amounts represented in exact Indian paise with zero float drift.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTx(null);
            onCloseAddModal();
            setTimeout(() => {
              (document.getElementById('open-quick-add-btn') as any)?.click();
            }, 50);
          }}
          id="trigger-add-btn"
          className="flex items-center gap-2 px-4 py-2 bg-[#0F5132] hover:bg-[#146c43] text-white rounded-lg text-xs font-semibold shadow-sm transition-all fintech-btn active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense / Income</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search bar */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search merchant, description, or UPI ref..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-[#0A0E14] border border-white/10 rounded-lg text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Type segmented control */}
          <div className="md:col-span-3 flex items-center bg-[#0A0E14] border border-white/10 rounded-lg p-0.5 text-xs">
            {(['ALL', 'EXPENSE', 'INCOME'] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setType(t);
                  setPage(1);
                }}
                className={`flex-1 py-1 rounded-md text-xs font-medium transition-all ${
                  type === t
                    ? 'bg-[#1A2029] text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t === 'ALL' ? 'All' : t === 'EXPENSE' ? 'Debits' : 'Credits'}
              </button>
            ))}
          </div>

          {/* Category Dropdown */}
          <div className="md:col-span-3">
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 bg-[#0A0E14] border border-white/10 rounded-lg text-slate-300 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Clear Filters CTA */}
          <div className="md:col-span-2 flex justify-end">
            {(search || type !== 'ALL' || category || startDate || endDate) && (
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
                className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="border border-white/10 bg-[#11161F] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 bg-[#0A0E14]/60 text-slate-400 font-medium">
                <th className="py-3 px-4 font-normal">Date & Time</th>
                <th className="py-3 px-4 font-normal">Merchant / Description</th>
                <th className="py-3 px-4 font-normal">Category</th>
                <th className="py-3 px-4 font-normal">Payment Method</th>
                <th className="py-3 px-4 font-normal text-right">Amount (₹ INR)</th>
                <th className="py-3 px-4 font-normal text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500 font-mono">
                    Loading cryptographic ledger records...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center space-y-2">
                    <div className="text-slate-400 font-medium">No transactions found</div>
                    <div className="text-[11px] text-slate-500">
                      Try resetting your filters or add your first expense record.
                    </div>
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const merchantMeta = getMerchantInitials(tx.description);
                  const isAnomaly = !!tx.anomaly_id;

                  return (
                    <tr key={tx.id} className="fintech-row group">
                      {/* Date & Time */}
                      <td className="py-3 px-4 font-mono text-slate-400 whitespace-nowrap">
                        <div className="text-white font-medium">{tx.date}</div>
                        <div className="text-[10px] text-slate-500">02:14 PM IST</div>
                      </td>

                      {/* Merchant Avatar + Description */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[10px] text-white shrink-0 border border-white/10"
                            style={{ backgroundColor: merchantMeta.bg }}
                          >
                            {merchantMeta.initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-white">{tx.description}</span>
                              {isAnomaly && (
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium"
                                  title={`Anomaly Alert: ${tx.anomaly_rule || 'Flagged Outlier'}`}
                                >
                                  <span>⚠️</span>
                                  <span className="font-mono text-[9px] uppercase">{tx.anomaly_level || 'ALERT'}</span>
                                </span>
                              )}
                            </div>
                            {tx.notes && <div className="text-[11px] text-slate-400 mt-0.5">{tx.notes}</div>}
                            {(tx.attachment_url || tx.attachmentUrl) && (
                              <div className="mt-1">
                                <a
                                  href={(tx.attachment_url || tx.attachmentUrl)!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors font-medium"
                                  title="View Receipt / Attachment"
                                >
                                  <Paperclip className="w-3 h-3 text-emerald-400" />
                                  <span>Receipt / PDF</span>
                                  <ExternalLink className="w-2.5 h-2.5 text-emerald-400" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
                          style={{
                            backgroundColor: `${tx.category_color || '#10B981'}15`,
                            color: tx.category_color || '#10B981',
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: tx.category_color || '#10B981' }}
                          />
                          {tx.category_name || 'General'}
                        </span>
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {getMethodChip(tx.payment_method)}
                      </td>

                      {/* Amount (₹ INR right-aligned with tabular-nums) */}
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold whitespace-nowrap tabular-nums text-sm ${
                          tx.type === 'INCOME' ? 'text-emerald-400' : 'text-slate-100'
                        }`}
                      >
                        {tx.type === 'INCOME' ? '+' : '-'}
                        {formatINR(tx.amount)}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100">
                          <button
                            onClick={() => setEditingTx(tx)}
                            className="p-1.5 rounded-md hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
                            title="Edit transaction"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 rounded-md hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete transaction"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>
              Page {page} of {totalPages} ({totalCount} items)
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-[#0A0E14] hover:bg-[#1A2029] border border-white/10 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-[#0A0E14] hover:bg-[#1A2029] border border-white/10 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 4. THE QUICK ADD RIGHT-SIDE SHEET (DESKTOP) / BOTTOM SHEET (MOBILE) */}
      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200">
          <div 
            className="w-full sm:max-w-md bg-[#11161F] border-l border-white/10 h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-right duration-200 overflow-y-auto"
          >
            {/* Sheet Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">
                  {editingTx ? 'Edit Transaction' : 'Record Transaction'}
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                  Exact Indian paise minor units representation
                </p>
              </div>
              <button
                onClick={closeSheet}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sheet Form Body */}
            <form onSubmit={(e) => handleSubmit(e, false)} className="p-5 space-y-4 flex-1 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {formError}
                </div>
              )}

              {/* 4.1 Type Segmented Control */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-[#0A0E14] border border-white/10 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFormType('EXPENSE')}
                  className={`py-2 rounded-md font-semibold transition-all ${
                    formType === 'EXPENSE'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Expense / Debit (-)
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('INCOME')}
                  className={`py-2 rounded-md font-semibold transition-all ${
                    formType === 'INCOME'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Income / Credit (+)
                </button>
              </div>

              {/* 4.1 Amount Input (Large focused ₹ prefix) */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Amount (₹ INR)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-lg font-bold text-emerald-400 font-mono">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={formAmountStr}
                    onChange={(e) => setFormAmountStr(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono text-xl font-bold tabular-nums focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  Stored as exact integer paise ({parseToPaise(formAmountStr)} units)
                </p>
              </div>

              {/* Description / Merchant */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Merchant / Recipient</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Swiggy, Amazon.in, Rent to Landlord"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
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
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  >
                    <option value="" disabled>Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
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
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* Payment Method Icon Chips */}
              <div>
                <label className="block text-slate-300 font-medium mb-1.5">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['UPI', 'Credit Card', 'Cash'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setFormMethod(m as any)}
                      className={`p-2 rounded-lg border text-[11px] font-medium flex items-center justify-center gap-1.5 transition-all ${
                        formMethod === m
                          ? 'bg-[#0F5132] border-emerald-500/50 text-white'
                          : 'bg-[#0A0E14] border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      {m === 'UPI' && <Smartphone className="w-3.5 h-3.5" />}
                      {m === 'Credit Card' && <CreditCard className="w-3.5 h-3.5" />}
                      {m === 'Cash' && <Banknote className="w-3.5 h-3.5" />}
                      <span>{m}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5.3 UPI Reference Field */}
              {formMethod === 'UPI' && (
                <div>
                  <label className="block text-slate-300 font-medium mb-1">UPI Reference / UTR (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI/4281/342198"
                    value={formUpiRef}
                    onChange={(e) => setFormUpiRef(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Notes</label>
                <input
                  type="text"
                  placeholder="Receipt number, tax memo, etc."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Receipt / Attachment Upload */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Receipt / Document Attachment (Image or PDF)
                </label>

                {formAttachmentUrl ? (
                  <div className="flex items-center justify-between p-2.5 bg-[#0A0E14] border border-emerald-500/30 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="text-xs text-white truncate font-medium">
                        {formAttachmentName || 'Attached Document'}
                      </span>
                      <a
                        href={formAttachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-400 hover:underline flex items-center gap-0.5 shrink-0 ml-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>View</span>
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFormAttachmentUrl('');
                        setFormAttachmentName('');
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="tx-file-upload-input"
                    />
                    <label
                      htmlFor="tx-file-upload-input"
                      className={`flex flex-col items-center justify-center p-3.5 border border-dashed rounded-lg cursor-pointer transition-all ${
                        uploadingAttachment
                          ? 'border-emerald-500/50 bg-emerald-500/5 pointer-events-none'
                          : 'border-white/15 bg-[#0A0E14] hover:border-emerald-500/40 hover:bg-[#131922]'
                      }`}
                    >
                      {uploadingAttachment ? (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <UploadCloud className="w-4 h-4 animate-bounce" />
                          <span className="text-xs font-semibold">Uploading to Vercel Blob...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400">
                          <UploadCloud className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="text-xs font-medium text-slate-300">Upload receipt (PNG, JPEG, WebP, PDF)</span>
                          <span className="text-[10px] text-slate-500 font-mono">Max 10MB</span>
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {uploadError && (
                  <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span>{uploadError}</span>
                  </p>
                )}
              </div>

              {/* Sheet Action Footer */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeSheet}
                  className="px-3.5 py-2 rounded-lg bg-[#0A0E14] hover:bg-[#1A2029] text-slate-300 font-semibold transition-all"
                >
                  Cancel
                </button>

                {!editingTx && (
                  <button
                    type="button"
                    onClick={() => handleSubmit(undefined, true)}
                    disabled={submitting}
                    className="px-3.5 py-2 rounded-lg bg-[#1A2029] hover:bg-[#232A35] text-white font-semibold transition-all"
                  >
                    Save & Add Another
                  </button>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-[#0F5132] hover:bg-[#146c43] text-white font-semibold shadow-sm transition-all disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : editingTx ? 'Update Entry' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
