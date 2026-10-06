'use client';

import React, { useState } from 'react';
import { ShoppingBag, Lock, CheckCircle2, ShieldCheck, ArrowRight, ExternalLink } from 'lucide-react';
import { formatINR } from '@/lib/money';

export default function DemoMerchantPage() {
  const [selectedMerchant, setSelectedMerchant] = useState('Swiggy');
  const [amountRupees, setAmountRupees] = useState('340.00');
  const [cardNumber, setCardNumber] = useState('4111 1111 1111 1111');
  const [holderName, setHolderName] = useState('Alex Mercer');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('123');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const formatCardNumber = (val: string) => {
    const raw = val.replace(/\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < raw.length; i += 4) {
      parts.push(raw.slice(i, i + 4));
    }
    return parts.join(' ');
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccess(null);
    setSubmitting(true);

    try {
      const amountMinor = Math.round(parseFloat(amountRupees) * 100);
      const ref = `ext_demo_${Date.now().toString(36)}`;
      const timestamp = new Date().toISOString();

      const payload = {
        event: 'payment.authorized',
        card_number: cardNumber.replace(/\s+/g, ''),
        amount_minor: amountMinor,
        currency: 'INR',
        merchant: selectedMerchant,
        merchant_category: selectedMerchant === 'Swiggy' || selectedMerchant === 'Zomato' ? 'Food Delivery' : 'Groceries',
        timestamp,
        reference: ref,
        is_internal_demo: true,
      };

      const res = await fetch('/api/v1/webhooks/card-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Payment failed on merchant gateway.');
      } else {
        setSuccess({
          ...data,
          merchant: selectedMerchant,
          amount_minor: amountMinor,
          ref,
        });
      }
    } catch {
      setErrorMsg('Network error connecting to payment gateway.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans">
      <div className="max-w-xl mx-auto w-full my-auto space-y-6">
        {/* Merchant Header Branding */}
        <div className="bg-[#11161F] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-md">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">{selectedMerchant} Checkout</h1>
                <p className="text-xs text-slate-400">External Merchant Demo · Live Webhook Target</p>
              </div>
            </div>

            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
              EXTERNAL DEMO
            </span>
          </div>

          {/* Banner */}
          <div className="p-3 rounded-xl bg-[#0A0E14] border border-white/5 flex items-start gap-2.5 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p>
              This simulates an independent merchant website. Submitting this form fires a webhook to FinTrack. If you have FinTrack open in another tab, watch it capture the expense in real time!
            </p>
          </div>

          {success ? (
            <div className="py-8 text-center space-y-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl animate-fade-in">
              <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Payment Successful!</h2>
                <p className="text-xs text-slate-300 mt-1">
                  Paid {formatINR(success.amount_minor)} at {success.merchant}
                </p>
                <div className="text-[11px] font-mono text-emerald-400 mt-2">
                  Transaction #{success.transaction_id.slice(0, 8)} auto-created via webhook
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => setSuccess(null)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold"
                >
                  Place Another Order
                </button>
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center gap-1.5"
                >
                  <span>Open FinTrack Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCheckout} className="space-y-4 text-xs">
              {errorMsg && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                  {errorMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Select Merchant</label>
                  <select
                    value={selectedMerchant}
                    onChange={(e) => {
                      setSelectedMerchant(e.target.value);
                      if (e.target.value === 'Swiggy') setAmountRupees('340.00');
                      if (e.target.value === 'Zomato') setAmountRupees('485.00');
                      if (e.target.value === 'BigBasket') setAmountRupees('2450.00');
                      if (e.target.value === 'Amazon.in') setAmountRupees('1899.00');
                    }}
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white"
                  >
                    <option value="Swiggy">Swiggy (Food Delivery)</option>
                    <option value="Zomato">Zomato (Food Delivery)</option>
                    <option value="BigBasket">BigBasket (Groceries)</option>
                    <option value="Amazon.in">Amazon.in (Shopping)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">Order Total (₹ INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amountRupees}
                    onChange={(e) => setAmountRupees(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Card Number (Demo PAN)</label>
                <input
                  type="text"
                  required
                  placeholder="4111 1111 1111 1111"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono tracking-wider text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Cardholder Name</label>
                <input
                  type="text"
                  required
                  value={holderName}
                  onChange={(e) => setHolderName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Expiry MM/YY</label>
                  <input
                    type="text"
                    required
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1">CVV</label>
                  <input
                    type="password"
                    required
                    maxLength={4}
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0A0E14] border border-white/10 rounded-lg text-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm shadow-xl disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4" />
                  <span>{submitting ? 'Processing on Payment Gateway...' : `Pay ${formatINR(Math.round(parseFloat(amountRupees || '0') * 100))}`}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
