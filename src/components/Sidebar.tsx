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
  CheckCircle2
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
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles, badge: 'Smart' },
    { id: 'audit', label: 'Audit Logs', icon: History, badge: 'SHA-256' },
  ];

  return (
    <aside className="w-64 min-w-[16rem] bg-slate-900 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none">
      {/* Top Header & Brand */}
      <div className="p-6">
        <div 
          className="flex items-center gap-3 cursor-pointer group" 
          onClick={() => onTabChange('dashboard')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-slate-900 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">FinTrack</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Secure Personal Finance</p>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <Lock className="w-3 h-3 text-indigo-400" />
            <span>AES-256</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Argon2id</span>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="mt-6">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 px-3 mb-2">
            Platform Navigation
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                        isActive
                          ? 'bg-white/20 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Bottom Profile / Account Area */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        {user ? (
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/50 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold uppercase ${
                      user.role === 'ADMIN'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {user.role}
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
        ) : (
          <button
            onClick={onOpenAuth}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <UserIcon className="w-4 h-4" />
            <span>Sign In / Demo</span>
          </button>
        )}
      </div>
    </aside>
  );
}
