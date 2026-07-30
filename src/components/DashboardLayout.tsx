'use client';

// ========================================================
// SuvarnaLoan ERP - Shared Dashboard Layout
// Location: src/components/DashboardLayout.tsx
// ========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Coins,
  Users,
  Package,
  Calculator,
  Receipt,
  FilePieChart,
  Settings,
  History,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ShieldCheck,
  TrendingUp,
  Building2,
  Bell,
  MessageSquare,
  Search,
  Lock,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { getSessionUser, setSessionUser, supabase, isRealSupabase } from '../lib/supabase/client';
import { db } from '../lib/supabase/supabaseDb';
import { User, Shop } from '../types';
import { formatCurrency, getRoleBadgeClass } from '../lib/utils';
import { Toaster, toast } from 'sonner';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [sidebarOpen, setSidebarOpenRaw] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateModalOpen, setRateModalOpen] = useState(false);

  // Rate inputs for live rate edit
  const [rate24k, setRate24k] = useState(7650);
  const [rate22k, setRate22k] = useState(7010);
  const [rate18k, setRate18k] = useState(5738);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const setSidebarOpen = (open: boolean) => {
    setSidebarOpenRaw(open);
    if (typeof document !== 'undefined') {
      if (open) document.body.classList.add('scroll-locked');
      else document.body.classList.remove('scroll-locked');
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sl_sidebar_collapsed');
      if (stored === 'true') setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sl_sidebar_collapsed', String(newVal));
    }
  };

  useEffect(() => {
    const session = getSessionUser();
    if (!session || !session.user) {
      router.push('/login');
      return;
    }

    setCurrentUser(session.user);
    setCurrentShop(session.shop);

    if (session.shop) {
      const initialShop = session.shop;
      setRate24k(initialShop.gold_rate_24k || 7650);
      setRate22k(initialShop.gold_rate_22k || 7010);
      setRate18k(initialShop.gold_rate_18k || 5738);

      // Query latest database values asynchronously
      db.getShop(initialShop.id).then((freshShop) => {
        if (freshShop) {
          setCurrentShop(freshShop);
          setRate24k(freshShop.gold_rate_24k || 7650);
          setRate22k(freshShop.gold_rate_22k || 7010);
          setRate18k(freshShop.gold_rate_18k || 5738);

          setSessionUser({
            ...session,
            shop: freshShop,
          });
        } else if (isRealSupabase) {
          // Shop account was deleted in Supabase database!
          setSessionUser(null);
          toast.error("Your shop account was deleted or deactivated in database");
          router.push('/login');
        }
      });
    }

    setLoading(false);

    const channel = new BroadcastChannel('suvarnaloan-sync');
    channel.onmessage = async (event) => {
      if (event.data && event.data.type === 'DB_UPDATE') {
        if (session.shop) {
          const freshShop = await db.getShop(session.shop.id);
          if (freshShop) {
            setCurrentShop(freshShop);
            setRate24k(freshShop.gold_rate_24k || 7650);
            setRate22k(freshShop.gold_rate_22k || 7010);
            setRate18k(freshShop.gold_rate_18k || 5738);
          }
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [router]);

  // When Rate Modal is opened, ensure latest database values populate the fields
  useEffect(() => {
    if (rateModalOpen && currentShop) {
      db.getShop(currentShop.id).then((freshShop) => {
        if (freshShop) {
          setCurrentShop(freshShop);
          setRate24k(freshShop.gold_rate_24k || 7650);
          setRate22k(freshShop.gold_rate_22k || 7010);
          setRate18k(freshShop.gold_rate_18k || 5738);
        }
      });
    }
  }, [rateModalOpen]);

  const handleLogout = async () => {
    setSessionUser(null);
    if (isRealSupabase && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Signout error:', err);
      }
    }
    router.push('/login');
  };

  const handleUpdateRates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;
    const ok = await db.updateShopGoldRates(currentShop.id, rate24k, rate22k, rate18k);
    if (ok) {
      const updatedShop: Shop = {
        ...currentShop,
        gold_rate_24k: rate24k,
        gold_rate_22k: rate22k,
        gold_rate_18k: rate18k,
      };
      setCurrentShop(updatedShop);

      const session = getSessionUser();
      if (session) {
        setSessionUser({
          ...session,
          shop: updatedShop,
        });
      }

      toast.success("Live Gold Rates updated across ERP & Database!");
      setRateModalOpen(false);
    } else {
      toast.error("Failed to update Gold Rates");
    }
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const dx = touchStartX.current - e.changedTouches[0].clientX;
    const dy = Math.abs(touchStartY.current - e.changedTouches[0].clientY);
    if (dx > 50 && dy < 80) {
      setSidebarOpen(false);
    }
    touchStartX.current = null;
    touchStartY.current = null;
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <span className="text-sm font-medium text-amber-200">Loading SuvarnaLoan ERP...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const navSections = [
    {
      group: 'MAIN',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: 'DAILY WORK',
      items: [
        { label: 'Gold Loans', href: '/dashboard/loans', icon: Coins },
        { label: 'Customers', href: '/dashboard/customers', icon: Users },
        { label: 'WhatsApp Logs', href: '/dashboard/whatsapp-logs', icon: MessageSquare },
        { label: 'Vault & Safe Stock', href: '/dashboard/gold-items', icon: Package },
        { label: 'Gold Calculator', href: '/dashboard/valuation', icon: Calculator },
        { label: 'Payments & Receipts', href: '/dashboard/payments', icon: Receipt },
      ],
    },
    {
      group: 'REPORTS & SETUP',
      items: [
        { label: 'Reports', href: '/dashboard/reports', icon: FilePieChart },
        { label: 'Settings & Rates', href: '/dashboard/settings', icon: Settings },
      ],
    },
  ];

  if (currentShop && currentShop.is_active === false && currentUser?.role !== 'Super Admin') {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
        <Toaster position="top-right" richColors />
        <div className="max-w-md w-full bg-slate-900 border border-rose-500/30 rounded-3xl p-8 shadow-2xl text-center space-y-6 relative z-10">
          <div className="w-16 h-16 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">Shop Account Deactivated</h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Access to <strong className="text-amber-400">{currentShop.shop_name}</strong> ERP has been deactivated by Platform Super Admin. All multi-tenant operations are suspended.
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Shop ID:</span>
              <span className="font-mono text-white">{currentShop.id}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Owner Name:</span>
              <span className="text-white font-bold">{currentShop.owner_name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Status:</span>
              <span className="text-rose-400 font-extrabold uppercase">Deactivated in Supabase DB</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                db.getShop(currentShop.id).then((fresh) => {
                  if (fresh && fresh.is_active !== false) {
                    setCurrentShop(fresh);
                    toast.success('Shop reactivated! Unlocking ERP...');
                  } else {
                    toast.error('Shop is still deactivated by Super Admin');
                  }
                });
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Check Activation Status</span>
            </button>
            <button
              onClick={() => {
                setSessionUser(null);
                router.push('/login');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors"
            >
              Logout to Login Screen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Toaster position="top-right" richColors />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 relative z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 flex items-center justify-center font-bold text-slate-950 shadow-md gold-glow">
                <Coins className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white">SuvarnaLoan</span>
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Humble Goats ERP</span>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="mx-auto w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-bold text-slate-950">
              <Coins className="w-5 h-5" />
            </div>
          )}
          <button
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Live Gold Rate Banner Badge */}
        {!isCollapsed && (
          <div className="m-3 p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Live 24K Rate
              </span>
              <span className="text-sm font-extrabold text-white">₹{rate24k}/g</span>
            </div>
            <button
              onClick={() => setRateModalOpen(true)}
              className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold transition-colors shadow-2xs"
            >
              Update
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
          {navSections.map((sec) => (
            <div key={sec.group} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                  {sec.group}
                </div>
              )}
              {sec.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950">
          {!isCollapsed ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
                  {currentUser.name[0]}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-semibold text-slate-200 truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-amber-400 font-medium">{currentUser.role}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-900 rounded-lg transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center p-2 text-slate-400 hover:text-rose-400 rounded-lg"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 md:hidden"
        />
      )}

      {/* Mobile Drawer */}
      <aside
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`fixed top-0 bottom-0 left-0 w-72 bg-slate-950 text-white z-50 flex flex-col transition-transform duration-300 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-bold text-slate-950">
              <Coins className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-sm">SuvarnaLoan ERP</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {navSections.map((sec) => (
            <div key={sec.group} className="space-y-1">
              <div className="px-3 text-[10px] font-extrabold text-amber-400 uppercase tracking-wider mb-1">
                {sec.group}
              </div>
              {sec.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                      isActive ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <span className="text-[10px] text-amber-400 font-semibold">{currentUser.role}</span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-rose-500/20 text-rose-300 text-xs rounded-lg font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg md:hidden"
            >
              <Menu className="w-5 h-5" />
            </button>

            {currentShop && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-xl">
                <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="text-xs font-bold text-amber-950 truncate max-w-[200px] md:max-w-xs">
                  {currentShop.shop_name}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900">
                  {currentShop.plan}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Live Today's Date Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs font-bold text-amber-950 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>

            {/* Live rates quick pill */}
            <div
              onClick={() => setRateModalOpen(true)}
              className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-slate-900 text-white rounded-xl cursor-pointer hover:bg-slate-800 transition-colors border border-amber-500/40"
            >
              <span className="text-[11px] text-amber-400 font-bold uppercase flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" /> 24K: ₹{rate24k}
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-slate-300 font-bold">22K: ₹{rate22k}</span>
            </div>

            <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${getRoleBadgeClass(currentUser.role)}`}>
              {currentUser.role}
            </span>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      {/* Gold Rate Master Modal */}
      {rateModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Coins className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Update Today's Live Gold Rates</h3>
              </div>
              <button onClick={() => setRateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRates} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">24K Fine Gold Rate (per gram in ₹)</label>
                <input
                  type="number"
                  value={rate24k}
                  onChange={(e) => setRate24k(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">22K Standard Gold Rate (per gram in ₹)</label>
                <input
                  type="number"
                  value={rate22k}
                  onChange={(e) => setRate22k(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">18K Gold Rate (per gram in ₹)</label>
                <input
                  type="number"
                  value={rate18k}
                  onChange={(e) => setRate18k(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRateModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 rounded-xl shadow-sm gold-glow"
                >
                  Save Gold Rates
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
