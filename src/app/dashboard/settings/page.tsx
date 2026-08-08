'use client';

// ========================================================
// SuvarnaLoan ERP - Bilingual Settings & Multi-Tenant Setup
// Supports English & Bank-Grade Marathi Language Selection
// Location: src/app/dashboard/settings/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Building2, Coins, ShieldCheck, History, Check, ArrowRight, RefreshCw, Sparkles, Activity, Languages } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { TouchCard } from '../../../components/ui/TouchCard';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Shop, AuditLog } from '../../../types';
import { formatDate } from '../../../lib/utils';
import { fetchLiveMetalRates, LiveMetalRates } from '../../../lib/liveMetalRatesApi';
import { toast } from 'sonner';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function SettingsPage() {
  const { dict, language, setLanguage, isMarathi } = useTranslation();

  const [shop, setShop] = useState<Shop | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Settings inputs
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [silverRate1kg, setSilverRate1kg] = useState(95000);
  const [useLiveRates, setUseLiveRates] = useState(true);
  const [syncingLive, setSyncingLive] = useState(false);
  const [liveRatesInfo, setLiveRatesInfo] = useState<LiveMetalRates | null>(null);

  useEffect(() => {
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) return;
    db.getShop(activeShopId).then((s) => {
      setShop(s);
      if (s) {
        setShopName(s.shop_name);
        setOwnerName(s.owner_name);
        setGstin(s.gstin || '');
        setAddress(s.address || '');
        setSilverRate1kg(s.silver_rate_1kg || 95000);
        setUseLiveRates(s.use_live_rates ?? true);
      }
    });

    fetchLiveMetalRates().then(setLiveRatesInfo);

    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('sl_audit_logs');
      if (raw) setAuditLogs(JSON.parse(raw));
    }
  }, []);

  const handleSyncLiveRatesNow = async () => {
    if (!shop?.id) return;
    setSyncingLive(true);
    try {
      const live = await fetchLiveMetalRates(true);
      setLiveRatesInfo(live);
      await db.updateShopGoldRates(
        shop.id,
        live.gold24kPerGram,
        live.gold22kPerGram,
        live.gold20kPerGram,
        live.gold18kPerGram,
        live.silver1kg
      );
      await db.updateShopLiveRateMode(shop.id, true);
      setUseLiveRates(true);
      setSilverRate1kg(live.silver1kg);
      setShop((prev) =>
        prev
          ? {
              ...prev,
              gold_rate_24k: live.gold24kPerGram,
              gold_rate_22k: live.gold22kPerGram,
              gold_rate_20k: live.gold20kPerGram,
              gold_rate_18k: live.gold18kPerGram,
              silver_rate_1kg: live.silver1kg,
              silver_rate_per_gram: live.silverPerGram,
              use_live_rates: true,
            }
          : null
      );
      toast.success(
        isMarathi
          ? `थेट सराफा बाजारभाव अद्ययावत झाले! २४ कॅरेट: ₹${live.gold24kPerGram}/g, २० कॅरेट: ₹${live.gold20kPerGram}/g, चांदी: ₹${live.silver1kg}/kg`
          : `Synced Live Indian Bullion Rates! 24K: ₹${live.gold24kPerGram}/g, 20K: ₹${live.gold20kPerGram}/g, Fine Silver: ₹${live.silver1kg}/kg`
      );
    } catch (err) {
      toast.error(isMarathi ? 'सराफा बाजारभाव सिंक करण्यात त्रुटी' : 'Failed to sync live metal rates');
    } finally {
      setSyncingLive(false);
    }
  };

  const handleToggleLiveMode = async (enabled: boolean) => {
    setUseLiveRates(enabled);
    if (shop?.id) {
      await db.updateShopLiveRateMode(shop.id, enabled);
    }
    toast.success(
      isMarathi
        ? (enabled ? 'थेट सराफा बाजारभाव ऑटो-सिंक सक्षम केले' : 'कस्टम सराफा दर मोड सुरू केला')
        : (enabled ? 'Live Market Rate Auto-Sync Enabled' : 'Switched to Custom Shop Benchmark Rates')
    );
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (shop?.id) {
      const g24 = shop.gold_rate_24k || 7650;
      await db.updateShopGoldRates(shop.id, g24, shop.gold_rate_22k || 7010, shop.gold_rate_20k || Math.round(g24 * (20 / 24)), shop.gold_rate_18k || 5738, silverRate1kg);
    }
    toast.success(dict.messages.settingsSavedSuccess);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto font-sans">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-600" />
            <span>{dict.settings.title}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            {dict.settings.subtitle}
          </p>
        </div>

        {/* Language Selection Card */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">{dict.settings.languageSection}</h2>
              <p className="text-xs text-slate-600 font-medium">{dict.settings.languageSubtitle}</p>
            </div>
          </div>

          <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setLanguage('en');
                toast.success(dict.messages.languageSwitched);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all duration-120 flex items-center gap-1.5 ${
                language === 'en'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>🇬🇧</span>
              <span>English</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage('mr');
                toast.success('भाषा यशस्वीरित्या मराठी करण्यात आली आहे!');
              }}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all duration-120 flex items-center gap-1.5 ${
                language === 'mr'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>🇮🇳</span>
              <span>मराठी (Marathi)</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shop Profile Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>{dict.settings.shopDetails}</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{dict.settings.shopName}</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{dict.settings.ownerName}</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{dict.settings.gstin}</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{dict.settings.rateSilver1kg}</label>
                <input
                  type="number"
                  value={silverRate1kg}
                  onChange={(e) => setSilverRate1kg(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                  {isMarathi ? `समतुल्य दर: ₹${Number((silverRate1kg / 1000).toFixed(2))} / ग्रॅम` : `Equivalent to ₹${Number((silverRate1kg / 1000).toFixed(2))} / gram`}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{dict.settings.address}</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-bold text-xs transition-all shadow-md mt-2"
              >
                {dict.settings.saveSettingsBtn}
              </button>
            </form>
          </div>

          {/* Bullion & Live Market Config */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>{dict.settings.bullionRates}</span>
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                  {useLiveRates ? (isMarathi ? 'थेट बाजारभाव' : 'Live Auto') : (isMarathi ? 'कस्टम दर' : 'Custom Shop')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-900 uppercase">24K Pure Gold</div>
                  <div className="text-base font-extrabold text-amber-950 mt-1">₹{shop?.gold_rate_24k || 7650}/g</div>
                </div>
                <div className="p-3 bg-amber-50/60 border border-amber-200/60 rounded-xl">
                  <div className="text-[10px] font-bold text-amber-900 uppercase">22K Standard 916</div>
                  <div className="text-base font-extrabold text-amber-950 mt-1">₹{shop?.gold_rate_22k || 7010}/g</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-600 uppercase">20K Hallmarked</div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">₹{shop?.gold_rate_20k || 6375}/g</div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[10px] font-bold text-slate-600 uppercase">18K Grade 750</div>
                  <div className="text-base font-extrabold text-slate-900 mt-1">₹{shop?.gold_rate_18k || 5738}/g</div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleSyncLiveRatesNow}
                  disabled={syncingLive}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/30 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingLive ? 'animate-spin' : ''}`} />
                  <span>{syncingLive ? dict.common.processing : dict.settings.syncLiveRates}</span>
                </button>

                <div className="flex items-center justify-between text-xs pt-1 px-1">
                  <span className="text-slate-600 font-medium">
                    {isMarathi ? 'थेट सराफा दर स्वयंचलित वापरा:' : 'Use Live Bullion Rates automatically:'}
                  </span>
                  <input
                    type="checkbox"
                    checked={useLiveRates}
                    onChange={(e) => handleToggleLiveMode(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Security & Audit Summary */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{dict.nav.auditLogs}</span>
              </h3>
              <p className="text-xs text-slate-500">
                {isMarathi
                  ? 'सर्व सुरक्षितता, कर्ज वाटप, परतफेड व पासवर्ड बदल ऑडिट लॉग्समध्ये कायमस्वरूपी नोंदवले जातात.'
                  : 'All security events, loan disbursals, repayments, and password changes are cryptographically logged.'}
              </p>
              <Link
                href="/dashboard/audit-logs"
                className="inline-flex items-center gap-2 text-xs font-bold text-amber-600 hover:text-amber-700 pt-1"
              >
                <span>{isMarathi ? 'संपूर्ण सुरक्षा ऑडिट लॉग्स पहा' : 'View Full Security Audit Log Trail'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
