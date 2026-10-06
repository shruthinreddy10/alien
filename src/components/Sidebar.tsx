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
  Smartphone,
  Inbox
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
}: SidebarProps) {
  if (!user) {
    return null;
  }

  const role = user.role;

  // 2.8 & 3.1 FinTech User Navigation with Payments Inbox
  const userNav = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'inbox', label: 'Payments Inbox', icon: Inbox, badge: 'Live 15', highlight: true },
    { id: 'transactions', label: 'Ledger', icon: ArrowRightLeft },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'goals', label: 'Savings Goals', icon: Target },
    { id: 'reports', label: 'Tax & Reports', icon: FileText },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles },
    { id: 'alerts', label: 'Anomalies', icon: AlertTriangle, badge: '2 Active' },
  ];

  const adminNav = [
    { id: 'admin-users', label: 'Users', icon: Users },
    { id: 'admin-security', label: 'Security & 2FA', icon: Shield },
    { id: 'admin-audit', label: 'Audit Trail', icon: History, badge: 'SHA-256' },
    { id: 'admin-health', label: 'Platform Health', icon: Activity },
    { id: 'admin-analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const settingsNav = [
    { id: 'settings-categories', label: 'Categories', icon: FolderTree },
    { id: 'settings-recurring', label: 'Recurring Rules', icon: Repeat },
    { id: 'settings-subscriptions', label: 'Subscriptions', icon: CreditCard },
    { id: 'settings-sessions', label: 'Active Sessions', icon: Smartphone },
    { id: 'settings-security', label: 'Credentials & Keys', icon: Lock },
  ];

  const homeTab = role === 'ADMIN' ? 'admin-users' : 'dashboard';

  return (
    <aside className="w-64 min-w-[16rem] bg-[#0A0E14] border-r border-white/10 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none overflow-y-auto">
      {/* Top Header & Brand */}
      <div className="p-5">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => onTabChange(homeTab)}
        >
          <div className="w-9 h-9 rounded-xl bg-[#0F5132] border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shadow-md">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">FinTrack</span>
              <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold border ${
                role === 'ADMIN' 
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {role === 'ADMIN' ? 'CONSOLE' : 'PRO'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {role === 'ADMIN' ? 'Platform Security & Admin' : 'INR · Wealth & Ledger'}
            </p>
          </div>
        </div>

        {/* Security Trust Badges */}
        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#11161F] border border-white/5 text-[10px] font-mono text-slate-300">
            <Lock className="w-2.5 h-2.5 text-emerald-400" />
            <span>AES-GCM</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#11161F] border border-white/5 text-[10px] font-mono text-slate-300">
            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
            <span>Argon2id</span>
          </div>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#11161F] border border-white/5 text-[10px] font-mono text-slate-300">
            <Shield className="w-2.5 h-2.5 text-amber-400" />
            <span>RBAC</span>
          </div>
        </div>

        {/* 1. ADMIN NAVIGATION */}
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
                        ? 'bg-[#1A2029] text-white border border-white/10 font-semibold'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-[#11161F] text-slate-400 border border-white/5">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* 2. USER NAVIGATION */}
        {role === 'USER' && (
          <>
            <div className="mt-5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-3 mb-1.5">
                Financial Suite
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
                          ? 'bg-[#0F5132] text-white font-semibold shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                          item.highlight
                            ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                            : isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[#11161F] text-slate-400 border border-white/5'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="mt-5 pt-3 border-t border-white/5">
              <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-3 mb-1.5">
                Preferences & Rules
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
                          ? 'bg-[#0F5132] text-white font-semibold'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-300' : 'text-slate-400'}`} />
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
      <div className="p-4 border-t border-white/10 bg-[#0A0E14] sticky bottom-0">
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-[#11161F] border border-white/5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-white truncate">{user.name}</div>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                    role === 'ADMIN'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {role}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono truncate">{user.email}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#11161F] hover:bg-rose-500/10 border border-white/5 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 text-xs font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
