'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import DashboardView from '@/components/DashboardView';
import TransactionsView from '@/components/TransactionsView';
import BudgetsView from '@/components/BudgetsView';
import AiAssistantView from '@/components/AiAssistantView';
import AuditLogsView from '@/components/AuditLogsView';
import GoalsView from '@/components/GoalsView';
import ReportsView from '@/components/ReportsView';
import AlertsView from '@/components/AlertsView';
import InboxView from '@/components/InboxView';
import CardsView from '@/components/CardsView';
import PaymentSimulatorView from '@/components/PaymentSimulatorView';
import AdminUsersView from '@/components/AdminUsersView';
import AdminSecurityView from '@/components/AdminSecurityView';
import AdminHealthView from '@/components/AdminHealthView';
import AdminAnalyticsView from '@/components/AdminAnalyticsView';
import SettingsViews from '@/components/SettingsViews';
import AuthModal from '@/components/AuthModal';
import { formatINR } from '@/lib/money';
import { Shield, Lock, Database, ArrowRight, Cpu, CheckCircle2, AlertOctagon, RefreshCw, Eye, EyeOff, Zap, Check } from 'lucide-react';

export default function HomePage() {
  const [user, setUser] = useState<{
    id: string;
    email: string;
    name: string;
    role: string;
    hasApiKey?: boolean;
    aiProvider?: string;
  } | null>(null);

  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [addTxModalOpen, setAddTxModalOpen] = useState(false);

  // App data states (for USER role only)
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Standalone public login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Fetch current session on mount
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        setUser(json.user);
        // Direct to role home or URL tab param if provided
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const requestedTab = urlParams?.get('tab');

        if (json.user.role === 'ADMIN') {
          setCurrentTab(requestedTab?.startsWith('admin-') ? requestedTab : 'admin-users');
        } else {
          setCurrentTab(requestedTab && !requestedTab.startsWith('admin-') ? requestedTab : 'dashboard');
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Load user finance data ONLY if role is USER
  const loadUserData = useCallback(async () => {
    if (!user || user.role !== 'USER') return;
    try {
      const [dashRes, catRes, budRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/categories'),
        fetch('/api/budgets'),
      ]);

      if (dashRes.ok) {
        const dJson = await dashRes.json();
        setDashboardData(dJson);
      } else {
        setDashboardData({
          kpis: { totalBalance: 0, totalIncome: 0, totalExpense: 0, savingsRate: 0, transactionCount: 0 },
          categorySpending: [],
          recentTransactions: [],
          monthlyTrends: [],
          overallBudget: { limit: 0, spent: 0, remainingCents: 0, percentage: 0, status: 'Healthy' },
          flaggedTransactions: [],
        });
      }
      if (catRes.ok) {
        const cJson = await catRes.json();
        setCategories(cJson.categories || []);
      }
      if (budRes.ok) {
        const bJson = await budRes.json();
        setBudgets(bJson.budgets || []);
      }
    } catch (e) {
      console.error('Failed to load user data:', e);
      setDashboardData({
        kpis: { totalBalance: 0, totalIncome: 0, totalExpense: 0, savingsRate: 0, transactionCount: 0 },
        categorySpending: [],
        recentTransactions: [],
        monthlyTrends: [],
        overallBudget: { limit: 0, spent: 0, remainingCents: 0, percentage: 0, status: 'Healthy' },
        flaggedTransactions: [],
      });
    }
  }, [user]);

  // Automatically fetch dashboard metrics whenever an authenticated user session is active
  useEffect(() => {
    if (user && user.role === 'USER') {
      loadUserData();
    }
  }, [user, loadUserData]);

  // Realtime Webhook Captured Toast State
  const [sseToast, setSseToast] = useState<{
    id: string;
    merchant: string;
    amount: number;
    category: string;
    cardLast4: string;
    hasAnomaly: boolean;
  } | null>(null);

  // SSE Realtime Stream Connection for authenticated USER
  useEffect(() => {
    if (!user || user.role !== 'USER') return;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/v1/stream/transactions');

      eventSource.addEventListener('transaction.created', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          const tx = payload.transaction;

          // Trigger live toast
          setSseToast({
            id: tx.id,
            merchant: tx.merchant || tx.description,
            amount: tx.amount,
            category: tx.categoryName || 'Food Delivery',
            cardLast4: tx.card_last4 || '1111',
            hasAnomaly: !!payload.hasAnomaly,
          });

          // Automatically reload user financial state
          loadUserData();

          // Auto-dismiss toast after 5s
          setTimeout(() => {
            setSseToast(null);
          }, 5000);
        } catch (err) {
          console.error('Error handling transaction.created SSE event:', err);
        }
      });
    } catch (err) {
      console.error('Failed to initialize SSE connection:', err);
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [user, loadUserData]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setDashboardData(null);
      setCategories([]);
      setBudgets([]);
      setCurrentTab('dashboard');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleAuthSuccess = (authenticatedUser: any) => {
    setUser(authenticatedUser);
    setAuthModalOpen(false);
    if (authenticatedUser.role === 'ADMIN') {
      setCurrentTab('admin-users');
    } else {
      setCurrentTab('dashboard');
      loadUserData();
    }
  };

  const handlePublicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Authentication failed. Please verify credentials.');
      } else {
        handleAuthSuccess(data.user);
      }
    } catch {
      setLoginError('Network error during login.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleQuickDemoLogin = async (demoEmail: string, demoPass: string) => {
    setLoginError('');
    setLoginSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: demoEmail, password: demoPass }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error || 'Demo login failed');
      } else {
        handleAuthSuccess(data.user);
      }
    } catch {
      setLoginError('Network error during login.');
    } finally {
      setLoginSubmitting(false);
    }
  };

  // Safe tab change guard: prevents illegal role cross-navigation
  const handleTabChange = (targetTab: string) => {
    if (!user) return;
    if (user.role === 'ADMIN' && !targetTab.startsWith('admin-')) {
      // Admin attempted to access personal finance tab
      setCurrentTab('403-admin-forbidden');
      return;
    }
    if (user.role === 'USER' && targetTab.startsWith('admin-')) {
      // User attempted to access admin tab
      setCurrentTab('403-user-forbidden');
      return;
    }
    setCurrentTab(targetTab);
  };

  // 1. Initial loading splash
  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
          <span className="text-xs font-mono">Initializing FinTrack Security Context...</span>
        </div>
      </div>
    );
  }

  // 2. MODE 1: PUBLIC SHELL (No sidebar, no topbar, clean authentication portal)
  if (!user) {
    return (
      <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
        {/* Public Top Minimal Header */}
        <header className="px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-white">FinTrack</span>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  SECURE
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
              <Lock className="w-3 h-3 text-indigo-400" />
              <span>AES-256-GCM</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>Argon2id</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
              <Shield className="w-3 h-3 text-amber-400" />
              <span>Strict RBAC</span>
            </div>
          </div>
        </header>

        {/* Public Split Card Layout */}
        <main className="max-w-6xl mx-auto w-full px-6 py-6 flex-1 flex items-center justify-center">
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Story / Security Credentials */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Build Secure 24 Hackathon Prototype</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                Enterprise Personal Finance & <br />
                <span className="text-indigo-400">Tamper-Evident Security</span>
              </h1>

              <p className="text-slate-400 text-sm max-w-lg leading-relaxed">
                FinTrack stores all currency in exact integer minor units, enforces strict row-level authorization to eliminate IDOR, and maintains SHA-256 tamper-evident cryptographic audit chains.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-indigo-400 font-mono text-xs font-bold">01. Integer Cents</div>
                  <div className="text-xs text-slate-300 font-semibold">Zero IEEE-754 Drift</div>
                  <div className="text-[11px] text-slate-500">Exact minor unit ledger calculations.</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-emerald-400 font-mono text-xs font-bold">02. AES-256 Vault</div>
                  <div className="text-xs text-slate-300 font-semibold">GCM Authenticated</div>
                  <div className="text-[11px] text-slate-500">Envelope encryption for provider keys.</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="text-amber-400 font-mono text-xs font-bold">03. Isolated RBAC</div>
                  <div className="text-xs text-slate-300 font-semibold">Operator Isolation</div>
                  <div className="text-[11px] text-slate-500">Admin strictly isolated from finance data.</div>
                </div>
              </div>
            </div>

            {/* Right Authentication Card */}
            <div className="lg:col-span-5">
              <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Sign In to Workspace</h2>
                  <p className="text-xs text-slate-400 mt-1">Select your role or enter credentials to continue</p>
                </div>

                {/* Instant 1-Click Evaluation Access */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      1-Click Evaluation Logins
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-mono font-bold">
                      DEMO SEED
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('user@demo.com', 'Password123!')}
                      disabled={loginSubmitting}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-emerald-500/50 text-left transition-all group"
                    >
                      <div className="font-bold text-emerald-400 flex items-center justify-between">
                        <span>User Role</span>
                        <span className="text-[9px] px-1 rounded bg-emerald-500/10 text-emerald-400 font-mono">FINANCE</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">user@demo.com</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleQuickDemoLogin('admin@demo.com', 'AdminPass123!')}
                      disabled={loginSubmitting}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700/80 hover:border-amber-500/50 text-left transition-all group"
                    >
                      <div className="font-bold text-amber-400 flex items-center justify-between">
                        <span>Admin Role</span>
                        <span className="text-[9px] px-1 rounded bg-amber-500/10 text-amber-400 font-mono">OPERATOR</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">admin@demo.com</div>
                    </button>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                    {loginError}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handlePublicLogin} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-300 font-medium mb-1">Password</label>
                    <div className="relative">
                      <input
                        type={loginShowPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full pl-3 pr-9 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-white font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setLoginShowPassword(!loginShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                      >
                        {loginShowPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loginSubmitting}
                    className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span>{loginSubmitting ? 'Authenticating...' : 'Sign In'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Need an account?</span>
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Register New Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Public Footer */}
        <footer className="px-6 py-4 border-t border-slate-900 text-center text-xs text-slate-500 font-mono">
          Build Secure 24 — Abhedya Cybersecurity Forum | VBIT Hyderabad
        </footer>

        <AuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  // 3. MODE 2: AUTHENTICATED SHELL (Sidebar + Main Content, Role-Scoped)
  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* 2-Column App Shell: Sidebar Navigation (Left) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Main Content Area (Right) */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {/* 3.1 403 FORBIDDEN SCREENS (Styled RBAC Guard with Return CTA) */}
            {currentTab === '403-admin-forbidden' && (
              <div className="py-12 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/10">
                  <AlertOctagon className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/30">
                    HTTP 403 FORBIDDEN — ROLE MISMATCH
                  </span>
                  <h2 className="text-2xl font-bold text-white tracking-tight mt-2">
                    Access Denied: Personal Finance Isolated
                  </h2>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Platform administrators operate exclusively in the security console and are strictly blocked from accessing personal finance ledgers or user transaction data.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentTab('admin-users')}
                    className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-all shadow-lg shadow-amber-600/20"
                  >
                    Return to Admin Console
                  </button>
                </div>
              </div>
            )}

            {currentTab === '403-user-forbidden' && (
              <div className="py-12 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-xl shadow-rose-500/10">
                  <AlertOctagon className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold border border-rose-500/30">
                    HTTP 403 FORBIDDEN — PRIVILEGE REQUIRED
                  </span>
                  <h2 className="text-2xl font-bold text-white tracking-tight mt-2">
                    Administrator Privileges Required
                  </h2>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    You do not have administrative clearance to access system security settings, audit logs, or platform health metrics.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => setCurrentTab('dashboard')}
                    className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            )}

            {/* 3.2 USER ROLE VIEWS: Strictly accessible only if role === 'USER' */}
            {user.role === 'USER' && (
              <>
                {currentTab === 'dashboard' && (
                  <DashboardView
                    data={dashboardData}
                    loading={!dashboardData}
                    onOpenAddTx={() => setAddTxModalOpen(true)}
                    onNavigateTab={handleTabChange}
                  />
                )}

                {currentTab === 'inbox' && (
                  <InboxView onRefreshDashboard={loadUserData} />
                )}

                {currentTab === 'transactions' && (
                  <TransactionsView
                    categories={categories}
                    onRefreshDashboard={loadUserData}
                    openAddModal={addTxModalOpen}
                    onCloseAddModal={() => setAddTxModalOpen(false)}
                  />
                )}

                {currentTab === 'budgets' && (
                  <BudgetsView
                    budgets={budgets}
                    categories={categories}
                    loading={false}
                    onRefresh={loadUserData}
                  />
                )}

                {currentTab === 'goals' && <GoalsView />}
                {currentTab === 'reports' && <ReportsView />}
                {currentTab === 'alerts' && <AlertsView />}

                {currentTab === 'ai' && (
                  <AiAssistantView
                    userHasKey={!!user.hasApiKey}
                    userProvider={user.aiProvider || 'mock'}
                    onRefreshUser={checkSession}
                  />
                )}

                {currentTab === 'cards' && <CardsView />}
                {currentTab === 'demo-pay' && <PaymentSimulatorView onNavigateTab={handleTabChange} />}

                {/* User Settings Sub-routes */}
                {currentTab === 'settings-categories' && <SettingsViews subTab="categories" />}
                {currentTab === 'settings-recurring' && <SettingsViews subTab="recurring" />}
                {currentTab === 'settings-subscriptions' && <SettingsViews subTab="subscriptions" />}
                {currentTab === 'settings-sessions' && <SettingsViews subTab="sessions" />}
                {currentTab === 'settings-security' && <SettingsViews subTab="security" />}
              </>
            )}

            {/* 3.3 ADMIN ROLE VIEWS: Strictly accessible only if role === 'ADMIN' */}
            {user.role === 'ADMIN' && (
              <>
                {currentTab === 'admin-users' && <AdminUsersView />}
                {currentTab === 'admin-security' && <AdminSecurityView />}
                {currentTab === 'admin-audit' && <AuditLogsView isAdmin={true} />}
                {currentTab === 'admin-health' && <AdminHealthView />}
                {currentTab === 'admin-analytics' && <AdminAnalyticsView />}
              </>
            )}
          </div>
        </main>
      </div>

      {/* Real-Time Auto-Captured Card Expense Toast (Bottom-Right with 5s Progress Bar) */}
      {sseToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#11161F] border border-emerald-500/40 rounded-xl p-4 shadow-2xl shadow-emerald-500/10 animate-slide-up text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white truncate">
                  {formatINR(sseToast.amount)} spent at {sseToast.merchant}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-bold bg-emerald-500/20 text-emerald-300">
                  AUTO
                </span>
              </div>
              <p className="text-slate-400 text-[11px] mt-0.5">
                Auto-captured via card •••• {sseToast.cardLast4} → {sseToast.category}
              </p>
              {sseToast.hasAnomaly && (
                <div className="mt-1 text-rose-400 font-semibold text-[10px]">
                  ⚠️ Flagged as potential anomaly for review
                </div>
              )}
            </div>
            <button
              onClick={() => setSseToast(null)}
              className="text-slate-400 hover:text-white"
            >
              &times;
            </button>
          </div>
          {/* 5-second animated progress bar */}
          <div className="w-full bg-slate-800 h-1 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full animate-[progress_5s_linear]" />
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
