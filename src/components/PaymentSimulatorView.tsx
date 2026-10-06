'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, CheckCircle2, AlertCircle, ShoppingCart, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function PaymentSimulatorView({ onNavigateTab }: { onNavigateTab?: (tab: string) => void }) {
  const [cards, setCards] = useState<any[]>([]);
  const [merchants, setMerchants] = useState<any[]>([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedMerchant, setSelectedMerchant] = useState('Swiggy');
  const [category, setCategory] = useState('Food Delivery');
  const [amountRupees, setAmountRupees] = useState('340.00');
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Load user's cards
    fetch('/api/v1/cards')
      .then((res) => res.json())
      .then((data) => {
        setCards(data.cards || []);
        if (data.cards?.length > 0) {
          setSelectedCardId(data.cards[0].id);
        }
      });

    // Load merchant presets
    fetch('/api/v1/demo/merchants')
      .then((res) => res.json())
      .then((data) => {
        setMerchants(data.merchants || []);
      });
  }, []);

  const handleMerchantChange = (mName: string) => {
    setSelectedMerchant(mName);
    const m = merchants.find((item) => item.name === mName);
    if (m) {
      setCategory(m.category);
      setAmountRupees((m.defaultAmount / 100).toFixed(2));
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessResult(null);

    if (!selectedCardId) {
      setErrorMsg('Please select or add a demo card first.');
      return;
    }

    const amountMinor = Math.round(parseFloat(amountRupees) * 100);
    if (isNaN(amountMinor) || amountMinor <= 0) {
      setErrorMsg('Please enter a valid payment amount.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/demo/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: selectedCardId,
          merchant: selectedMerchant,
          amount_minor: amountMinor,
          merchant_category: category,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Payment failed.');
      } else {
        setSuccessResult(data);
      }
    } catch {
      setErrorMsg('Network error dispatching simulated payment.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCard = cards.find((c) => c.id === selectedCardId);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-6 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
              DEMO SIMULATOR
            </span>
            <span className="text-xs text-slate-400">Zero manual typing</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mt-1">
            Card Payment Simulator
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Simulate a real-time card swipe. Dispatches a cryptographic webhook to auto-capture the expense into FinTrack without user intervention.
          </p>
        </div>

        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ShoppingCart className="w-6 h-6" />
        </div>
      </div>

      {cards.length === 0 ? (
        <div className="border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-10 text-center space-y-4">
          <CreditCard className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="font-bold text-white text-base">No Linked Demo Cards</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            You must link at least one demo card before using the simulator.
          </p>
          <button
            onClick={() => onNavigateTab && onNavigateTab('cards')}
            className="px-4 py-2 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-semibold shadow-md inline-flex items-center gap-2"
          >
            <span>Go to Cards → Link Demo Card</span>
          </button>
        </div>
      ) : (
        <div className="border border-[var(--border-hairline)] bg-[var(--bg-elev-1)] rounded-xl p-6 shadow-lg space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successResult ? (
            <div className="p-8 text-center space-y-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Payment Authorized & Captured!</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Webhook <code className="text-emerald-400 font-mono text-[11px]">{successResult.webhook_ref}</code> verified with HMAC-SHA256.
                </p>
              </div>

              <div className="max-w-md mx-auto p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--border-hairline)] text-xs text-left space-y-1.5 font-mono">
                <div className="flex justify-between text-slate-400">
                  <span>Merchant:</span>
                  <span className="text-white font-bold">{selectedMerchant}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Amount Debited:</span>
                  <span className="text-emerald-400 font-bold">{formatINR(Math.round(parseFloat(amountRupees) * 100))}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Auto-Category:</span>
                  <span className="text-white">{category}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Card Used:</span>
                  <span className="text-white">{selectedCard?.brand} •••• {selectedCard?.last4}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Ledger Status:</span>
                  <span className="text-emerald-400">Auto-Created (CARD_WEBHOOK)</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={() => setSuccessResult(null)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-elev-2)] hover:bg-[var(--bg-elev-3)] text-slate-300 text-xs font-semibold"
                >
                  Simulate Another Payment
                </button>
                <button
                  onClick={() => onNavigateTab && onNavigateTab('transactions')}
                  className="px-5 py-2 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  <span>View in Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handlePay} className="space-y-5">
              {/* Quick Select Presets */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Pick Demo Merchant:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {merchants.slice(0, 8).map((m) => (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => handleMerchantChange(m.name)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedMerchant === m.name
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 shadow-sm'
                          : 'bg-[var(--bg-base)] border-[var(--border-hairline)] text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-xs truncate">{m.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {formatINR(m.defaultAmount)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Merchant Name
                  </label>
                  <input
                    type="text"
                    required
                    value={selectedMerchant}
                    onChange={(e) => setSelectedMerchant(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Auto-Mapped Category
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Payment Amount (₹ INR)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-semibold text-sm">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 bg-[var(--bg-base)] border border-[var(--border-hairline)] rounded-lg text-white font-mono text-lg font-bold focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Card Picker */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Pay With Linked Card:
                </label>
                <div className="space-y-2">
                  {cards.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedCardId === c.id
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                          : 'bg-[var(--bg-base)] border-[var(--border-hairline)] text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="cardSelect"
                          value={c.id}
                          checked={selectedCardId === c.id}
                          onChange={() => setSelectedCardId(c.id)}
                          className="accent-emerald-500"
                        />
                        <div>
                          <div className="font-semibold text-xs text-white">
                            {c.brand} •••• {c.last4} ({c.nickname})
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            Expires {String(c.expiry_month).padStart(2, '0')}/{String(c.expiry_year).slice(-2)} · Token: {c.token.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-black/40 text-emerald-400 font-bold border border-white/5">
                        ACTIVE
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Dispatches HMAC-SHA256 signed webhook</span>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-white font-semibold text-sm shadow-lg disabled:opacity-50 transition-all active:scale-95 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-emerald-300" />
                  <span>{submitting ? 'Authorizing Payment...' : `Pay ${formatINR(Math.round(parseFloat(amountRupees || '0') * 100))}`}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
