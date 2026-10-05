'use client';

import React, { useState } from 'react';
import { Shield, Lock, Mail, User as UserIcon, X, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: { id: string; email: string; name: string; role: string }) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score;
  };

  const strength = getPasswordStrength(password);
  const strengthLabels = ['Too Weak', 'Weak', 'Fair', 'Strong', 'Very Secure'];
  const strengthColors = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { name, email, password } : { email, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Authentication failed. Please verify credentials.');
      } else {
        onSuccess(data.user);
        onClose();
      }
    } catch {
      setError('Network error during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPass: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Demo login failed');
      } else {
        onSuccess(data.user);
        onClose();
      }
    } catch {
      setError('Network error during demo login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                {isRegister ? 'Create FinTrack Account' : 'Welcome to FinTrack'}
              </h2>
              <p className="text-[11px] text-slate-400">Strict Row-Level Authorization & AES-256-GCM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security Badges Row */}
        <div className="grid grid-cols-3 gap-2 py-1">
          <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Argon2id</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>AES-256-GCM</span>
          </div>
          <div className="flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>Strict RBAC</span>
          </div>
        </div>

        {/* Quick 1-Click Demo Login Banner */}
        <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
          <div className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Instant Demo Access (Click to Authenticate)</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => handleDemoLogin('user@demo.com', 'Password123!')}
              disabled={loading}
              className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-indigo-500/50 text-slate-200 font-medium transition-all text-left"
            >
              <div className="font-bold text-emerald-400 flex items-center justify-between">
                <span>User Role</span>
                <span className="text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-400">FINANCE</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">user@demo.com</div>
            </button>

            <button
              type="button"
              onClick={() => handleDemoLogin('admin@demo.com', 'AdminPass123!')}
              disabled={loading}
              className="py-2 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700 hover:border-amber-500/50 text-slate-200 font-medium transition-all text-left"
            >
              <div className="font-bold text-amber-400 flex items-center justify-between">
                <span>Admin Role</span>
                <span className="text-[9px] px-1 rounded bg-amber-500/10 text-amber-400">OPERATOR</span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">admin@demo.com</div>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800">
          <button
            type="button"
            onClick={() => { setIsRegister(false); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
              !isRegister
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(true); setError(''); }}
            className={`flex-1 py-2 text-xs font-semibold border-b-2 transition-all ${
              isRegister
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {isRegister && (
            <div>
              <label className="block text-slate-300 font-medium mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-300 font-medium mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-medium mb-1">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength meter for registration */}
            {isRegister && password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Strength:</span>
                  <span className="font-semibold text-slate-300">{strengthLabels[strength]}</span>
                </div>
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-300 ${strengthColors[strength]}`}
                    style={{ width: `${Math.max(15, (strength / 4) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>{loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
