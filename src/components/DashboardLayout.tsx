'use client';

// ========================================================
// SuvarnaLoan ERP - Shared Dashboard Layout with Bilingual Support
// Location: src/components/DashboardLayout.tsx
// ========================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { RealtimeProvider } from '../providers/RealtimeProvider';
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
  Languages,
} from 'lucide-react';
import { getSessionUser, setSessionUser, supabase, isRealSupabase } from '../lib/supabase/client';
import { db, setupRealtimeSync, clearDbCache } from '../lib/supabase/supabaseDb';
import { User, Shop } from '../types';
import { formatCurrency, getRoleBadgeClass } from '../lib/utils';
import { Toaster, toast } from 'sonner';
import { useTranslation } from '../providers/LanguageProvider';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { dict, language, setLanguage, isMarathi } = useTranslation();

  const [sidebarOpen, setSidebarOpenRaw] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [rateModalOpen, setRateModalOpen] = useState(false);

  // Rate inputs for live rate edit (supports string | number for smooth typing)
  const [rate24k, setRate24k] = useState<number | string>(7650);
  const [rate22k, setRate22k] = useState<number | string>(7010);
  const [rate20k, setRate20k] = useState<number | string>(6375);
  const [rate18k, setRate18k] = useState<number | string>(5738);
  const [rateSilver1kg, setRateSilver1kg] = useState<number | string>(95000);

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
      const r24 = initialShop.gold_rate_24k || 7650;
      setRate24k(r24);
      setRate22k(initialShop.gold_rate_22k || 7010);
      setRate20k(initialShop.gold_rate_20k || Math.round(r24 * (20 / 24)));
      setRate18k(initialShop.gold_rate_18k || 5738);
      setRateSilver1kg(initialShop.silver_rate_1kg || 95000);

      // Query latest database values asynchronously
      db.getShop(initialShop.id).then((freshShop) => {
        if (freshShop) {
          setCurrentShop(freshShop);
          const fresh24 = freshShop.gold_rate_24k || 7650;
          setRate24k(fresh24);
          setRate22k(freshShop.gold_rate_22k || 7010);
          setRate20k(freshShop.gold_rate_20k || Math.round(fresh24 * (20 / 24)));
          setRate18k(freshShop.gold_rate_18k || 5738);
          setRateSilver1kg(freshShop.silver_rate_1kg || 95000);

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

    const handleGlobalDataRefresh = async () => {
      const activeSession = getSessionUser();
      const targetShopId = activeSession?.shop?.id || activeSession?.user?.shop_id;
      if (targetShopId) {
        const freshShop = await db.getShop(targetShopId);
        if (freshShop) {
          setCurrentShop(freshShop);
          const fresh24 = freshShop.gold_rate_24k || 7650;
          setRate24k(fresh24);
          setRate22k(freshShop.gold_rate_22k || 7010);
          setRate20k(freshShop.gold_rate_20k || Math.round(fresh24 * (20 / 24)));
          setRate18k(freshShop.gold_rate_18k || 5738);
          setRateSilver1kg(freshShop.silver_rate_1kg || 95000);

          if (activeSession) {
            setSessionUser({
              ...activeSession,
              shop: freshShop,
            });
          }
        }
      }
    };

    // Listen to central RealtimeProvider custom event for multi-device cloud sync
    const handleRealtimeEvent = () => {
      handleGlobalDataRefresh();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeEvent);
      window.addEventListener('suvarnaloan-db-update', handleRealtimeEvent);
    }

    // BroadcastChannel (Same-Device Browser Tab Sync)
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('suvarnaloan-sync');
      channel.onmessage = async (event) => {
        if (event.data && event.data.type === 'DB_UPDATE') {
          handleGlobalDataRefresh();
        }
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeEvent);
        window.removeEventListener('suvarnaloan-db-update', handleRealtimeEvent);
      }
      if (channel) channel.close();
    };
  }, [router]);

  // When Rate Modal is opened, load current values ONCE without loop resets
  useEffect(() => {
    if (rateModalOpen) {
      const session = getSessionUser();
      const s = session?.shop || currentShop;
      if (s) {
        const fresh24 = s.gold_rate_24k || 7650;
        setRate24k(fresh24);
        setRate22k(s.gold_rate_22k || 7010);
        setRate20k(s.gold_rate_20k || Math.round(fresh24 * (20 / 24)));
        setRate18k(s.gold_rate_18k || 5738);
        setRateSilver1kg(s.silver_rate_1kg || 95000);
      }
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
    const session = getSessionUser();
    const targetShopId = currentShop?.id || session?.shop?.id || session?.user?.shop_id;
    if (!targetShopId) return;

    const num24 = Number(rate24k) || 7650;
    const num22 = Number(rate22k) || Math.round(num24 * (22 / 24));
    const num20 = Number(rate20k) || Math.round(num24 * (20 / 24));
    const num18 = Number(rate18k) || Math.round(num24 * (18 / 24));
    const numSilver = Number(rateSilver1kg) || 95000;
    const silverPerGram = Number((numSilver / 1000).toFixed(2));

    const res = await db.updateShopGoldRates(targetShopId, num24, num22, num20, num18, numSilver);
    if (res.success) {
      const updatedShop: Shop = {
        ...(currentShop || session?.shop || ({} as Shop)),
        id: targetShopId,
        gold_rate_24k: num24,
        gold_rate_22k: num22,
        gold_rate_20k: num20,
        gold_rate_18k: num18,
        silver_rate_1kg: numSilver,
        silver_rate_per_gram: silverPerGram,
        last_rate_sync_at: new Date().toISOString(),
      };
      setCurrentShop(updatedShop);
      setRate24k(num24);
      setRate22k(num22);
      setRate20k(num20);
      setRate18k(num18);
      setRateSilver1kg(numSilver);

      if (session) {
        setSessionUser({
          ...session,
          shop: updatedShop,
        });
      }

      toast.success(isMarathi ? `सराफा बाजारभाव ₹${num24}/ग्रॅम अद्ययावत केले!` : `Live Gold Rates updated to ₹${num24.toLocaleString('en-IN')}/g!`);
      setRateModalOpen(false);
    } else {
      toast.error(res.error || (isMarathi ? "सराफा दर अद्ययावत करण्यात त्रुटी. कृपया पुन्हा प्रयत्न करा." : "Failed to update Live 24K Gold Rate. Please try again."));
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
      <div className="flex h-screen w-screen items-center justify-center bg-slate-900 text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
          <span className="text-sm font-medium text-amber-200">
            {isMarathi ? 'सुवर्ण कर्ज ईआरपी सुरू होत आहे...' : 'Loading SuvarnaLoan ERP...'}
          </span>
        </div>
      </div>
    );
  }

  if (!currentUser) return null;

  const navSections = [
    {
      group: isMarathi ? 'मुख्य विभाग' : 'MAIN',
      items: [
        { label: dict.nav.dashboard, href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      group: isMarathi ? 'दैनिक कार्यप्रणाली' : 'DAILY WORK',
      items: [
        { label: dict.nav.loans, href: '/dashboard/loans', icon: Coins },
        { label: dict.nav.customers, href: '/dashboard/customers', icon: Users },
        { label: dict.nav.whatsapp, href: '/dashboard/whatsapp-logs', icon: MessageSquare },
        { label: dict.nav.goldItems, href: '/dashboard/gold-items', icon: Package },
        { label: dict.nav.goldValuation, href: '/dashboard/valuation', icon: Calculator },
        { label: dict.nav.payments, href: '/dashboard/payments', icon: Receipt },
      ],
    },
    {
      group: isMarathi ? 'अहवाल व संस्था' : 'REPORTS & SETUP',
      items: [
        { label: dict.nav.reports, href: '/dashboard/reports', icon: FilePieChart },
        { label: dict.nav.settings, href: '/dashboard/settings', icon: Settings },
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
            <h2 className="text-xl font-black text-white tracking-tight">
              {isMarathi ? 'पेढीचे खाते निलंबित केले आहे' : 'Shop Account Deactivated'}
            </h2>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              {isMarathi
                ? `सुपर ॲडमिनद्वारे ${currentShop.shop_name} चे ईआरपी खाते तात्पुरते बंद करण्यात आले आहे.`
                : `Access to ${currentShop.shop_name} ERP has been deactivated by Platform Super Admin.`
              }
            </p>
          </div>

          <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Shop ID:</span>
              <span className="font-mono text-white">{currentShop.id}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{isMarathi ? 'मालकाचे नाव:' : 'Owner Name:'}</span>
              <span className="text-white font-bold">{currentShop.owner_name}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>{isMarathi ? 'स्थिती:' : 'Status:'}</span>
              <span className="text-rose-400 font-extrabold uppercase">Deactivated in Supabase DB</span>
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => {
                db.getShop(currentShop.id).then((fresh) => {
                  if (fresh && fresh.is_active !== false) {
                    setCurrentShop(fresh);
                    toast.success(isMarathi ? 'खाते पुन्हा सक्रिय झाले!' : 'Shop reactivated! Unlocking ERP...');
                  } else {
                    toast.error(isMarathi ? 'खाते अद्याप निलंबित आहे' : 'Shop is still deactivated by Super Admin');
                  }
                });
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>{isMarathi ? 'सक्रियता तपासा' : 'Check Activation Status'}</span>
            </button>
            <button
              onClick={() => {
                setSessionUser(null);
                router.push('/login');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors"
            >
              {isMarathi ? 'लॉगिन पृष्ठावर जा' : 'Logout to Login Screen'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RealtimeProvider shopId={currentShop?.id}>
      <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Toaster position="top-right" richColors />

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-slate-800 bg-slate-950 text-white transition-all duration-300 sticky top-0 h-screen shrink-0 z-30 overflow-hidden ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800/80 shrink-0">
          {!isCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-300 flex items-center justify-center font-bold text-slate-950 shadow-md gold-glow">
                <Coins className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white">{isMarathi ? 'सुवर्ण कर्ज' : 'SuvarnaLoan'}</span>
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Enterprise ERP</span>
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
          <div className="mx-3 my-2 p-3 rounded-xl bg-slate-900 border border-amber-500/30 flex items-center justify-between shrink-0">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> {isMarathi ? '२४ कॅरेट भाव' : 'Live 24K Rate'}
              </span>
              <span className="text-sm font-extrabold text-white">₹{rate24k}/g</span>
            </div>
            <button
              onClick={() => setRateModalOpen(true)}
              className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold transition-all subtle-press shadow-2xs"
            >
              {isMarathi ? 'बदला' : 'Update'}
            </button>
          </div>
        )}

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-120 subtle-press ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900'
                    } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0 transition-transform duration-120" />
                    {!isCollapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User Profile Card */}
        <div className="mx-3 my-3 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between shrink-0">
          {!isCollapsed ? (
            <>
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0 shadow-xs">
                  {currentUser.name[0]}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-bold text-slate-100 truncate">{currentUser.name}</span>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{currentUser.role}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                title={dict.nav.logout}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center p-1 text-slate-400 hover:text-rose-400 rounded-lg"
              title={dict.nav.logout}
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
            <span className="font-bold text-white text-sm">{isMarathi ? 'सुवर्ण कर्ज ईआरपी' : 'SuvarnaLoan ERP'}</span>
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

        {/* Mobile User Profile Card */}
        <div className="mx-4 my-3 p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400 text-xs shrink-0">
              {currentUser.name[0]}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white">{currentUser.name}</span>
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{currentUser.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title={dict.nav.logout}
          >
            <LogOut className="w-4 h-4" />
          </button>
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
                <span className="text-xs font-bold text-amber-950 truncate max-w-[180px] md:max-w-xs">
                  {currentShop.shop_name}
                </span>
                <span className="hidden sm:inline-block text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900">
                  {currentShop.plan}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            {/* Quick Interactive Language Switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setLanguage('en');
                  toast.success("Language switched to English");
                }}
                className={`px-2.5 py-1 rounded-lg transition-all duration-120 ${
                  language === 'en'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => {
                  setLanguage('mr');
                  toast.success("भाषा यशस्वीरित्या मराठी करण्यात आली आहे!");
                }}
                className={`px-2.5 py-1 rounded-lg transition-all duration-120 ${
                  language === 'mr'
                    ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                मराठी
              </button>
            </div>

            {/* Live Today's Date Pill */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200/80 rounded-xl text-xs font-bold text-amber-950 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>
                {new Date().toLocaleDateString(isMarathi ? 'mr-IN' : 'en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-600" />
                <span>{isMarathi ? 'सराफा बाजारभाव अद्ययावत करा' : 'Update Gold Bullion Rates'}</span>
              </h2>
              <button
                onClick={() => setRateModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRates} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    {dict.settings.rate24k} (₹/gram)
                  </label>
                  <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    99.9% Pure Gold
                  </span>
                </div>
                <input
                  type="number"
                  min="1000"
                  step="1"
                  value={rate24k}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRate24k(val === '' ? '' : Number(val));
                    const num = Number(val);
                    if (num > 0) {
                      setRate22k(Math.round(num * 0.9166));
                      setRate20k(Math.round(num * (20 / 24)));
                      setRate18k(Math.round(num * 0.75));
                    }
                  }}
                  placeholder="e.g. 7200"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl font-black text-slate-950 text-base focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50/40"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {isMarathi ? '२२ कॅरेट (₹/g)' : '22K 916 (₹/g)'}
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1"
                    value={rate22k}
                    onChange={(e) => setRate22k(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="7010"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {isMarathi ? '२० कॅरेट (₹/g)' : '20K Hallmarked (₹/g)'}
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1"
                    value={rate20k}
                    onChange={(e) => setRate20k(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="6375"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 block mb-1">
                    {isMarathi ? '१८ कॅरेट (₹/g)' : '18K 750 (₹/g)'}
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1"
                    value={rate18k}
                    onChange={(e) => setRate18k(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="5738"
                    className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-800">
                    {isMarathi ? 'चांदी दर (₹ / किलो)' : 'Fine Silver Rate (₹ / 1 kg)'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-bold">
                    ₹{Number((Number(rateSilver1kg || 95000) / 1000).toFixed(2))}/g
                  </span>
                </div>
                <input
                  type="number"
                  min="10000"
                  step="100"
                  value={rateSilver1kg}
                  onChange={(e) => setRateSilver1kg(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="95000"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRateModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors"
                >
                  {dict.common.cancel}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs shadow-md transition-all active:scale-95"
                >
                  {isMarathi ? 'दर अद्ययावत करा' : 'Save & Update All Modules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </RealtimeProvider>
  );
}
