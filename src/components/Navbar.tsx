'use client';

import React from 'react';
import { Shield, Wallet, ArrowRightLeft, PieChart, Sparkles, History, LogOut, User as UserIcon } from 'lucide-react';

interface NavbarProps {
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

export default function Navbar({
  currentTab,
  onTabChange,
  user,
  onLogout,
  onOpenAuth,
}: NavbarProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Wallet },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'budgets', label: 'Budgets', icon: PieChart },
    { id: 'ai', label: 'AI Assistant', icon: Sparkles, badge: 'Smart' },
    { id: 'audit', label: 'Audit Trail', icon: History, badge: 'SHA-256' },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#090D16]/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('dashboard')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#090D16] rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">FinTrack</span>
              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AES-GCM
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">Secure Personal Finance</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] p-1 rounded-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        )}

        {/* User Account / Auth Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-200 flex items-center justify-end gap-1.5">
                  <span>{user.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                      user.role === 'ADMIN'
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30'
                    }`}
                  >
                    {user.role}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
              </div>

              <button
                onClick={onLogout}
                title="Logout"
                className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/10 border border-white/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
            >
              <UserIcon className="w-4 h-4" />
              <span>Sign In / Demo</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      {user && (
        <div className="md:hidden flex items-center justify-around border-t border-white/5 py-2 px-2 bg-[#090D16]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex flex-col items-center gap-1 p-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  isActive ? 'text-indigo-400 font-bold' : 'text-slate-400'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
