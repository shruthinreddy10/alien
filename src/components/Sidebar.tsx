'use client';

import React from 'react';
import { 
  Shield, 
  LayoutDashboard, 
  ArrowRightLeft, 
  PieChart, 
  Sparkles, 
  History, 
  LogOut, 
  User as UserIcon,
  Lock,
  CheckCircle2,
  Target,
  FileText,
  AlertTriangle,
  Users,
  Activity,
  BarChart3,
  FolderTree,
  Repeat,
  CreditCard,
  Smartphone
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  onLogout: () => void;
  onOpenAuth: () => void;
}

export default function Sidebar({
  currentTab,
  onTabChange,
  user,
  onLogout,
  onOpenAuth,
}: SidebarProps) {
  // If no authenticated user, the sidebar should NOT render (Mode 1: Public Shell)
  if (!user) {
    return null;
  }

  const role = user.role;

  // Strict Role Navigation Definitions
  const userNav = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles, badge: 'Smart' },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle, badge: '2 Active' },
  ];

  const adminNav = [
    { id: 'admin-users', label: 'Users', icon: Users },
    { id: 'admin-security', label: 'Security', icon: Shield },
    { id: 'admin-audit', label: 'Audit Logs', icon: History, badge: 'SHA-256' },
    { id: 'admin-health', label: 'Health', icon: Activity },
    { id: 'admin-analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const settingsNav = [
    { id: 'settings-categories', label: 'Categories', icon: FolderTree },
    { id: 'settings-recurring', label: 'Recurring', icon: Repeat },
    { id: 'settings-subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'settings-sessions', label: 'Sessions', icon: Smartphone },
    { id: 'settings-security', label: 'Security & 2FA', icon: Lock },
  ];

  const homeTab = role === 'ADMIN' ? 'admin-users' : 'dashboard';

  return (
    <aside className="w-64 min-w-[16rem] bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none overflow-y-auto">
      {/* Top Header & Brand */}
      <div className="p-5">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => onTabChange(homeTab)}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">FinTrack</span>
              <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border ${
                role === 'ADMIN' 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {role === 'ADMIN' ? 'CONSOLE' : 'PRO'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {role === 'ADMIN' ? 'Platform Security & Operations' : 'Secure Personal Finance'}
            </p>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>AES-256</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Argon2id</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <Shield className="w-3 h-3 text-amber-400" />
            <span>RBAC</span>
          </div>
        </div>

        {/* 1. ADMIN SHELL: Render ONLY Admin Console navigation (ZERO personal finance items) */}
        {role === 'ADMIN' && (
          <div className="mt-5">
            <div className="flex items-center justify-between px-3 mb-2">
              <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                Admin Console
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold">
                ISOLATED
              </span>
            </div>
            <nav className="space-y-1">
              {adminNav.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-amber-600 text-white font-semibold shadow-md shadow-amber-600/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-amber-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* 2. USER SHELL: Render Personal Finance + Settings (ZERO admin items) */}
        {role === 'USER' && (
          <>
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-3 mb-1.5">
                Personal Finance
              </div>
              <nav className="space-y-0.5">
                {userNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-800/80">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-3 mb-1.5">
                Account & Settings
              </div>
              <nav className="space-y-0.5">
                {settingsNav.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                    </button>
                  );
                })}
              </nav>
            </div>
          </>
        )}
      </div>

      {/* Bottom Profile / Account Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50 sticky bottom-0">
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                    role === 'ADMIN'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                  }`}
                >
                  {role}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono truncate">{user.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-500/10 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
