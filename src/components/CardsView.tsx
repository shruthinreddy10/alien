'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, Trash2, CheckCircle2, ShieldCheck, Lock, AlertCircle, X, Sparkles } from 'lucide-react';

export default function CardsView() {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Add Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [holderName, setHolderName] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchCards = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/cards');
      if (res.ok) {
        const json = await res.json();
        setCards(json.cards || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, []);

  const formatCardNumberInput = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  const formatExpiryInput = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      return `${raw.slice(0, 2)}/${raw.slice(2, 4)}`;
    }
    return raw;
  };

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber,
          holderName,
          expiry,
          cvv,
          nickname,
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || 'Failed to add demo card.');
      } else {
        setSuccessMsg('Demo card securely tokenized and linked!');
        setCardNumber('');
        setHolderName('');
        setExpiry('');
        setCvv('');
        setNickname('');
        setPassword('');
        setTimeout(() => {
          setSheetOpen(false);
          setSuccessMsg('');
        }, 1200);
        fetchCards();
      }
    } catch {
      setErrorMsg('Network error adding card.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCard = async (id: string, last4: string) => {
    if (!confirm(`Are you sure you want to remove card •••• ${last4}? Its webhook token will be permanently destroyed.`)) return;

    try {
      const res = await fetch(`/api/v1/cards/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCards();
      } else {
        alert('Failed to remove card.');
      }
    } catch {
      alert('Network error removing card.');
    }
  };

  const getBrandGradient = (brand: string) => {
    switch (brand) {
      case 'VISA':
        return 'from-blue-900/80 via-slate-900 to-indigo-950 border-blue-500/30';
      case 'MASTERCARD':
        return 'from-amber-950/80 via-slate-900 to-red-950 border-amber-500/30';
      case 'RUPAY':
        return 'from-emerald-950/80 via-slate-900 to-teal-950 border-emerald-500/30';
      case 'AMEX':
        return 'from-cyan-950/80 via-slate-900 to-blue-950 border-cyan-500/30';
      default:
        return 'from-slate-900 via-slate-950 to-slate-900 border-white/10';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <span>Card-Linked Expense Capture</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simulate real-time webhook-driven auto expense logging without manual entry.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMsg('');
            setSuccessMsg('');
            setSheetOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-lg text-xs font-semibold shadow-md transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add Demo Card</span>
        </button>
      </div>

      {/* PCI-DSS Security Notice Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-[var(--border-hairline)] flex items-start gap-3 text-xs text-slate-300">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-white">PCI-DSS Compliant Mock Tokenization:</span>
          <p className="text-slate-400 mt-0.5 leading-relaxed">
            Full card PAN and CVV are never stored, logged, or returned to the browser. Only the last 4 digits and a cryptographically generated token (<code className="text-emerald-400 font-mono text-[11px]">card_tok_xxxx</code>) are preserved for webhook matching.
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-[var(--bg-elev-1)] border border-[var(--border-hairline)]" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-12 text-center space-y-3">
          <CreditCard className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="font-semibold text-slate-200">No demo cards linked</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add a demo card in 30 seconds. When you pay on our demo merchant or simulator, expenses appear instantly in your ledger.
          </p>
          <button
            onClick={() => setSheetOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white rounded-lg text-xs font-semibold shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Add Demo Card</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((c) => (
            <div
              key={c.id}
              className={`relative rounded-2xl p-6 border bg-gradient-to-br shadow-xl flex flex-col justify-between h-52 transition-all hover:-translate-y-1 ${getBrandGradient(c.brand)}`}
            >
              {/* Card Top */}
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                    {c.nickname}
                  </span>
                  <div className="text-xs font-semibold text-white">{c.holder_name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono tracking-wider px-2 py-0.5 rounded bg-black/40 text-white border border-white/10">
                    {c.brand}
                  </span>
                  <button
                    onClick={() => handleDeleteCard(c.id, c.last4)}
                    className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                    title="Remove card"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Card Middle PAN Mask */}
              <div className="my-2">
                <div className="text-lg font-mono tracking-widest text-white flex items-center gap-3">
                  <span>••••</span>
                  <span>••••</span>
                  <span>••••</span>
                  <span className="font-bold text-emerald-400">{c.last4}</span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="flex items-end justify-between text-xs pt-2 border-t border-white/10">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-mono">Expires</div>
                  <div className="font-mono text-white font-semibold">
                    {String(c.expiry_month).padStart(2, '0')}/{String(c.expiry_year).slice(-2)}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-emerald-300">Linked & Active</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Demo Card Right-Side Sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--bg-elev-1)] border-l border-[var(--border-hairline)] h-full overflow-y-auto p-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-hairline)]">
                <div>
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-400" />
                    <span>Link New Demo Card</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">PCI-compliant demo tokenization</p>
                </div>
                <button
                  onClick={() => setSheetOpen(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleAddCard} className="space-y-4 text-xs">
                {/* Demo autofill preset buttons */}
                <div className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--border-hairline)] space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>1-Tap Demo Card Presets</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCardNumber('4111 1111 1111 1111');
                        setHolderName('Alex Mercer');
                        setExpiry('12/28');
                        setCvv('123');
                        setNickname('ICICI Visa Credit Card');
                      }}
                      className="px-2.5 py-1.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 border border-blue-500/20 text-[11px] font-mono"
                    >
                      Preset: Visa 1111
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCardNumber('6080 1234 5678 4821');
                        setHolderName('Alex Mercer');
                        setExpiry('06/27');
                        setCvv('456');
                        setNickname('HDFC RuPay Debit');
                      }}
                      className="px-2.5 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 text-[11px] font-mono"
                    >
                      Preset: RuPay 4821
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Card Number (Demo PAN)</label>
                  <input
                    type="text"
                    required
                    placeholder="4111 1111 1111 1111"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white font-mono tracking-wider focus:outline-none focus:border-emerald-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Never stored: dropped after extracting last 4 digits.
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Cardholder Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Mercer"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      required
                      placeholder="12/28"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiryInput(e.target.value))}
                      className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">CVV (Masked)</label>
                    <input
                      type="password"
                      required
                      maxLength={4}
                      placeholder="•••"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                      className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white font-mono text-center focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Card Label / Nickname</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ICICI Credit Card"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Password Confirmation for PCI-grade re-auth */}
                <div className="pt-2 border-t border-[var(--border-hairline)]">
                  <label className="block text-amber-400 font-semibold mb-1">
                    Confirm Account Password (Re-authentication)
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Enter password (e.g. user123)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-amber-500/30 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Security gate: Re-authentication is required before minting payment tokens.
                  </span>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="px-4 py-2 rounded-lg bg-[var(--bg-elev-2)] hover:bg-[var(--bg-elev-3)] text-slate-300 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-semibold shadow-md disabled:opacity-50 transition-all active:scale-95"
                  >
                    {submitting ? 'Tokenizing...' : 'Confirm & Link Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
