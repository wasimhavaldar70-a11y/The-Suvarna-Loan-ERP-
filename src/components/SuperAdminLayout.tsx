'use client';

// ========================================================
// SuvarnaLoan ERP - Super Admin Portal Layout
// Location: src/components/SuperAdminLayout.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  Users,
  History,
  LogOut,
  Menu,
  X,
  Plus,
  Coins,
  Settings,
  Activity,
  Sparkles,
  Search,
  CheckCircle2
} from 'lucide-react';
import { getSessionUser, setSessionUser } from '../lib/supabase/client';
import { User } from '../types';
import { Toaster, toast } from 'sonner';

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSessionUser();
    if (!session || session.user.role !== 'Super Admin') {
      toast.error('Super Admin access required. Redirecting...');
      router.push('/login');
      return;
    }
    setCurrentUser(session.user);
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    setSessionUser(null);
    toast.success('Logged out from Super Admin Portal');
    router.push('/login');
  };

  const navItems = [
    { label: 'Platform Overview', href: '/admin/dashboard', icon: Building2 },
  ];

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <span className="text-sm font-semibold text-amber-200">Authenticating Super Admin Portal...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans flex flex-col md:flex-row">
      <Toaster position="top-right" richColors />

      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between bg-slate-900 border-b border-slate-800 px-4 py-3 sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl text-slate-950 font-black">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-sm text-white tracking-tight block">SuvarnaLoan</span>
            <span className="text-[10px] font-black uppercase text-amber-400">Super Admin Portal</span>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:text-white"
        >
          {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 p-5 flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 md:static ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="space-y-6">
          {/* Brand Logo & Title */}
          <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl text-slate-950 shadow-lg shadow-amber-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-base text-white tracking-tight">SuvarnaLoan</h2>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                Super Admin Portal
              </span>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-sm">
              WH
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-black text-white truncate">{currentUser?.name || 'Wasim Havaldar'}</div>
              <div className="text-[10px] font-bold text-amber-400">Super Admin</div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section & Logout */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-[11px] font-semibold text-emerald-300">Multi-Tenant Engine Active</span>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
