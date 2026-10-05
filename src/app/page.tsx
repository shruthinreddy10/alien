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
import AdminUsersView from '@/components/AdminUsersView';
import AdminSecurityView from '@/components/AdminSecurityView';
import AdminHealthView from '@/components/AdminHealthView';
import AdminAnalyticsView from '@/components/AdminAnalyticsView';
import SettingsViews from '@/components/SettingsViews';
import AuthModal from '@/components/AuthModal';
import { Shield, Lock, Database, ArrowRight, Cpu } from 'lucide-react';

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
    <div className="min-h-screen flex bg-slate-950 text-slate-100">
      {/* 2-Column App Shell: Sidebar Navigation (Left) */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        user={user}
        onLogout={handleLogout}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Main Content Area (Right) */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
        <main className="flex-1 p-8 overflow-y-auto">
          {user ? (
            <div className="max-w-7xl mx-auto w-full">
              {/* Core User Tabs */}
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

              {/* Admin Console Sections */}
              {currentTab === 'admin-users' && <AdminUsersView />}
              {currentTab === 'admin-security' && <AdminSecurityView />}
              {currentTab === 'admin-audit' && <AuditLogsView isAdmin={true} />}
              {currentTab === 'admin-health' && <AdminHealthView />}
              {currentTab === 'admin-analytics' && <AdminAnalyticsView />}

              {/* User Settings Sub-routes */}
              {currentTab === 'settings-categories' && <SettingsViews subTab="categories" />}
              {currentTab === 'settings-recurring' && <SettingsViews subTab="recurring" />}
              {currentTab === 'settings-subscriptions' && <SettingsViews subTab="subscriptions" />}
              {currentTab === 'settings-sessions' && <SettingsViews subTab="sessions" />}
              {currentTab === 'settings-security' && <SettingsViews subTab="security" />}
            </div>
          ) : (
            /* Unauthenticated Landing */
            <div className="max-w-4xl mx-auto py-16 space-y-12">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Build Secure 24 Hackathon Prototype</span>
                </div>

                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
                  Enterprise Personal Finance & <br />
                  <span className="text-indigo-400">Tamper-Evident Security</span>
                </h1>

                <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
                  FinTrack stores all currency as exact integer minor units, eliminates IDOR through strict row-level authorization, and encrypts API keys at rest with AES-256-GCM.
                </p>

                <div className="pt-2">
                  <button
                    onClick={() => setAuthModalOpen(true)}
                    className="px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-xl shadow-indigo-600/30 transition-all inline-flex items-center gap-2"
                  >
                    <span>Sign In to Demo Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 space-y-2.5">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Integer Minor Units</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Eliminates IEEE-754 floating point drift by storing currency in exact integer cents/paise across all ledgers.
                  </p>
                </div>

                <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 space-y-2.5">
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">AES-256-GCM Vault</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Envelope encryption for user-supplied provider keys with authenticated tags. Never returned in plaintext.
                  </p>
                </div>

                <div className="border border-slate-800 bg-slate-900/90 rounded-xl p-6 space-y-2.5">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-white">Private AI Assistant</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Tool-calling over authenticated user data with offline fallback when no external LLM key is configured.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
