'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import DashboardView from '@/components/DashboardView';
import TransactionsView from '@/components/TransactionsView';
import BudgetsView from '@/components/BudgetsView';
import AiAssistantView from '@/components/AiAssistantView';
import AuditLogsView from '@/components/AuditLogsView';
import AuthModal from '@/components/AuthModal';
import { 
  Shield, 
  Lock, 
  Sparkles, 
  Database, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Cpu
} from 'lucide-react';

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

  // App data states
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch current session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const json = await res.json();
        setUser(json.user);
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

  // Load user data once logged in
  const loadUserData = useCallback(async () => {
    if (!user) return;
    try {
      const [dashRes, catRes, budRes] = await Promise.all([
        fetch('/api/dashboard'),
        fetch('/api/categories'),
        fetch('/api/budgets'),
      ]);

      if (dashRes.ok) {
        const dJson = await dashRes.json();
        setDashboardData(dJson);
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
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadUserData();
    }
  }, [user, loadUserData]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      setDashboardData(null);
      setCurrentTab('dashboard');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleAuthSuccess = (authenticatedUser: any) => {
    setUser(authenticatedUser);
    setAuthModalOpen(false);
    loadUserData();
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16]">
      <Navbar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {user ? (
          <div>
            {currentTab === 'dashboard' && (
              <DashboardView
                data={dashboardData}
                loading={!dashboardData}
                onOpenAddTx={() => setAddTxModalOpen(true)}
                onNavigateTab={setCurrentTab}
              />
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

            {currentTab === 'ai' && (
              <AiAssistantView
                userHasKey={!!user.hasApiKey}
                userProvider={user.aiProvider || 'mock'}
                onRefreshUser={checkSession}
              />
            )}

            {currentTab === 'audit' && (
              <AuditLogsView isAdmin={user.role === 'ADMIN'} />
            )}
          </div>
        ) : (
          /* Unauthenticated Landing / Demo Entry */
          <div className="py-12 sm:py-20 space-y-16">
            <div className="text-center max-w-3xl mx-auto space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>Build Secure 24 Hackathon Prototype</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Enterprise Finance with <br />
                <span className="bg-gradient-to-r from-emerald-400 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  Zero Float Drift & Private AI
                </span>
              </h1>

              <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                FinTrack stores all currency as exact integer minor units, eliminates IDOR through strict row-level authorization, encrypts API keys at rest with AES-256-GCM, and maintains a cryptographic SHA-256 hash-chained audit ledger.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => setAuthModalOpen(true)}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center gap-2"
                >
                  <span>Launch Demo Workspace</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="glass-panel p-6 rounded-3xl space-y-3 glass-panel-hover">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-white">Integer Minor Units</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Eliminates IEEE-754 floating point drift by storing currency in exact integer cents/paise across all ledgers.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-3xl space-y-3 glass-panel-hover">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Lock className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-white">AES-256-GCM Key Vault</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Envelope encryption for user-supplied OpenAI, Anthropic, or Gemini keys with authenticated tags. Never returned in plaintext.
                </p>
              </div>

              <div className="glass-panel p-6 rounded-3xl space-y-3 glass-panel-hover">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
                  <Cpu className="w-5 h-5" />
                </div>
                <h2 className="font-bold text-base text-white">Private AI Assistant</h2>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Autonomous tool-calling over authenticated user data with intelligent offline mock fallback when offline.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500">
        <p>FinTrack &bull; Build Secure 24 &bull; Team SleetAce Squad (ID: 76) &bull; Abhedya VBIT Cybersecurity Forum</p>
      </footer>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
