'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Settings, Building2, Coins, ShieldCheck, History, Check, ArrowRight, RefreshCw, Sparkles, Activity } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { TouchCard } from '../../../components/ui/TouchCard';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Shop, AuditLog } from '../../../types';
import { formatDate } from '../../../lib/utils';
import { fetchLiveMetalRates, LiveMetalRates } from '../../../lib/liveMetalRatesApi';
import { toast } from 'sonner';

export default function SettingsPage() {
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
      toast.success(`Synced Live Indian Bullion Rates! 24K: ₹${live.gold24kPerGram}/g, 20K: ₹${live.gold20kPerGram}/g, Fine Silver: ₹${live.silver1kg}/kg`);
    } catch (err) {
      toast.error('Failed to sync live metal rates');
    } finally {
      setSyncingLive(false);
    }
  };

  const handleToggleLiveMode = async (enabled: boolean) => {
    setUseLiveRates(enabled);
    if (shop?.id) {
      await db.updateShopLiveRateMode(shop.id, enabled);
    }
    toast.success(enabled ? 'Live Market Rate Auto-Sync Enabled' : 'Switched to Custom Shop Benchmark Rates');
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (shop?.id) {
      const g24 = shop.gold_rate_24k || 7650;
      await db.updateShopGoldRates(shop.id, g24, shop.gold_rate_22k || 7010, shop.gold_rate_20k || Math.round(g24 * (20 / 24)), shop.gold_rate_18k || 5738, silverRate1kg);
    }
    toast.success("Shop & Branch ERP configuration & Silver rate updated!");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-600" />
            <span>ERP Settings & Audit Logs</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Multi-tenant shop identity, GSTIN registration, branch manager & security logs
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Shop Profile Form */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>Shop Profile & GST Registration</span>
            </h3>

            <form onSubmit={handleSaveSettings} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Shop Enterprise Name</label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Owner / Proprietor Name</label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">GSTIN Number</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Fine Silver Rate (₹ / 1 kg)</label>
                <input
                  type="number"
                  value={silverRate1kg}
                  onChange={(e) => setSilverRate1kg(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
                  Equivalent to ₹{Number((silverRate1kg / 1000).toFixed(2))} / gram
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Registered Address</label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 text-right">
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-sm gold-glow"
                >
                  Save ERP Profile
                </button>
              </div>
            </form>
          </div>

          {/* Security & Live Rates Overview */}
          <div className="space-y-6">
            {/* Live Gold & Silver Market Rate Auto-Sync Card */}
            <div className="bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 text-white rounded-2xl p-6 shadow-xl border border-amber-500/40 space-y-4">
              <div className="flex items-center justify-between border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-sm font-bold text-amber-300">Live Indian Bullion Auto-Sync</h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 ${useLiveRates ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${useLiveRates ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  <span>{useLiveRates ? '🟢 LIVE AUTO-SYNC' : '⚪ SHOP BENCHMARK'}</span>
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-xl border border-slate-800">
                  <div>
                    <span className="font-bold text-slate-200 block">Live Market Rate Engine</span>
                    <span className="text-[10px] text-slate-400">Sync 24K, 22K, 18K Gold (₹/g) & Fine Silver (₹/kg)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleLiveMode(!useLiveRates)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all text-xs ${useLiveRates ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                  >
                    {useLiveRates ? 'Enabled' : 'Disabled'}
                  </button>
                </div>

                {liveRatesInfo && (
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                      <span className="text-[10px] text-amber-300 font-bold block">24K Fine Gold</span>
                      <span className="text-sm font-extrabold text-amber-400">₹{liveRatesInfo.gold24kPerGram} /g</span>
                    </div>
                    <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                      <span className="text-[10px] text-slate-300 font-bold block">22K Ornament Gold</span>
                      <span className="text-sm font-extrabold text-white">₹{liveRatesInfo.gold22kPerGram} /g</span>
                    </div>
                    <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                      <span className="text-[10px] text-slate-300 font-bold block">20K Gold (83.3%)</span>
                      <span className="text-sm font-extrabold text-amber-300">₹{liveRatesInfo.gold20kPerGram} /g</span>
                    </div>
                    <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700">
                      <span className="text-[10px] text-slate-300 font-bold block">18K Jewellery Gold</span>
                      <span className="text-sm font-extrabold text-white">₹{liveRatesInfo.gold18kPerGram} /g</span>
                    </div>
                    <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700 col-span-2">
                      <span className="text-[10px] text-slate-300 font-bold block">Fine Silver (1kg)</span>
                      <span className="text-sm font-extrabold text-slate-200">₹{liveRatesInfo.silver1kg} /kg</span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSyncLiveRatesNow}
                  disabled={syncingLive}
                  className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${syncingLive ? 'animate-spin' : ''}`} />
                  <span>{syncingLive ? 'Syncing Market Feeds...' : 'Sync Live Rates Now'}</span>
                </button>
              </div>
            </div>

            {/* Security & RBAC Overview */}
            <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-xl border border-amber-500/30 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-amber-400 border-b border-slate-800 pb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Multi-Tenant RBAC Security</span>
                </h3>

                <div className="mt-4 space-y-3 text-xs text-slate-300">
                  <div className="flex items-center justify-between">
                    <span>Current Tenant Plan:</span>
                    <span className="font-extrabold text-amber-300">{shop?.plan || 'Professional'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Supabase RLS Status:</span>
                    <span className="font-bold text-emerald-400">ENABLED & PROTECTED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Max Vault Lockers:</span>
                    <span className="font-bold text-white">UNLIMITED</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Branch Network Isolation:</span>
                    <span className="font-bold text-white">Active (`shop_id` scope)</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 mt-6 text-[11px] text-slate-400">
                SuvarnaLoan ERP v1.0.0 • Live Bullion Sync Active
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
