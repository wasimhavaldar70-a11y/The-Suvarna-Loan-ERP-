'use client';

// ========================================================
// SuvarnaLoan ERP - Standalone Gold Valuation Engine Tool
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/valuation/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Calculator, Coins, ShieldCheck, Scale, AlertCircle } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { calculateGoldValuation } from '../../../lib/goldValuationEngine';
import { formatCurrency, formatWeight } from '../../../lib/utils';
import { fetchLiveMetalRates } from '../../../lib/liveMetalRatesApi';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function ValuationPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [metalType, setMetalType] = useState<'Gold' | 'Silver'>('Gold');
  const [rate24k, setRate24k] = useState<number | string>(7650);
  const [silverRatePerGram, setSilverRatePerGram] = useState<number | string>(95);
  const [grossWeight, setGrossWeight] = useState<number | string>('');
  const [stoneWeight, setStoneWeight] = useState<number | string>('');
  const [karat, setKarat] = useState('22K (91.6%)');
  const [ltv, setLtv] = useState(75);
  const [loadingLive, setLoadingLive] = useState(false);

  const loadShopRates = () => {
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) return;
    db.getShopGoldRates(activeShopId).then((rates) => {
      setRate24k(rates.gold24k);
      setSilverRatePerGram(rates.silverPerGram);
    });
  };

  useEffect(() => {
    loadShopRates();

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'shops') {
        loadShopRates();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', loadShopRates);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', loadShopRates);
      }
    };
  }, []);

  const handleSyncLive = async () => {
    setLoadingLive(true);
    try {
      const session = getSessionUser();
      const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
      const live = await fetchLiveMetalRates(true);
      setRate24k(live.gold24kPerGram);
      setSilverRatePerGram(live.silverPerGram);
      if (activeShopId) {
        await db.updateShopGoldRates(
          activeShopId,
          live.gold24kPerGram,
          live.gold22kPerGram,
          live.gold20kPerGram,
          live.gold18kPerGram,
          live.silver1kg
        );
      }
    } catch (err) {
      console.warn('Valuation live sync error:', err);
    } finally {
      setLoadingLive(false);
    }
  };

  const result = calculateGoldValuation({
    metalType,
    grossWeightGrams: Number(grossWeight) || 0,
    stoneWeightGrams: Number(stoneWeight) || 0,
    purityKarat: karat,
    goldRatePerGram24K: Number(rate24k) || 7650,
    silverRatePerGram: Number(silverRatePerGram) || 95,
    ltvPercentage: ltv,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto font-sans">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Calculator className="w-6 h-6 text-amber-600" />
              <span>{isMarathi ? 'अचूक सोने व चांदी कर्ज मूल्यांकन इंजिन' : 'Precision Gold & Silver Loan Valuation Engine'}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {isMarathi
                ? 'बीआयएस (BIS) हॉलमार्किंग मानकांनुसार अचूक निव्वळ वजन, ७५% कमाल एलटीव्ही व कर्ज मर्यादा गणना'
                : 'BIS hallmarking purity matrices, gross stone net weight appraisal, and RBI 75% LTV sanction ceilings'}
            </p>
          </div>
        </div>

        {/* Calculation Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs Section */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-600" />
              {isMarathi ? 'मूल्यांकन घटक व मापदंड' : 'Valuation Parameters'}
            </h3>

            {/* Metal Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isMarathi ? 'धातूचा प्रकार निवडा' : 'Select Metal Type'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMetalType('Gold');
                    setKarat('22K (91.6%)');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    metalType === 'Gold'
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  🪙 {isMarathi ? 'सोने (Gold)' : 'Gold'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetalType('Silver');
                    setKarat('925 Sterling Silver (92.5%)');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    metalType === 'Silver'
                      ? 'bg-slate-700 text-white border-slate-800 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  🥈 {isMarathi ? 'चांदी (Silver)' : 'Silver'}
                </button>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {metalType === 'Gold' ? (isMarathi ? '२४ कॅरेट सोन्याचा दर (₹/ग्रॅम)' : '24K Gold Rate (₹/g)') : (isMarathi ? 'चांदीचा दर (₹/ग्रॅम)' : 'Silver Rate (₹/g)')}
                </label>
                <button
                  type="button"
                  onClick={handleSyncLive}
                  disabled={loadingLive}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-700 underline"
                >
                  {loadingLive ? (isMarathi ? 'सिंक होत आहे...' : 'Syncing...') : (isMarathi ? '⚡ थेट दर मिळवा' : '⚡ Sync Live')}
                </button>
              </div>
              <input
                type="number"
                value={metalType === 'Gold' ? rate24k : silverRatePerGram}
                onChange={(e) => {
                  const val = e.target.value;
                  const parsed = val === '' ? '' : Number(val);
                  if (metalType === 'Gold') {
                    setRate24k(parsed);
                  } else {
                    setSilverRatePerGram(parsed);
                  }
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{dict.goldItem.grossWeight}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder={isMarathi ? 'एकूण वजन प्रविष्ट करा' : 'Enter gross weight'}
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{dict.goldItem.stoneWeight}</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.000"
                  value={stoneWeight}
                  onChange={(e) => setStoneWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{dict.goldItem.purity}</label>
              <select
                value={karat}
                onChange={(e) => setKarat(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 focus:ring-2 focus:ring-amber-500"
              >
                {metalType === 'Gold' ? (
                  <>
                    <option value="24K (99.9%)">24K (99.9%) - Fine Gold</option>
                    <option value="22K (91.6%)">22K (91.6%) - 916 Hallmark</option>
                    <option value="20K (83.3%)">20K (83.3%) - Traditional</option>
                    <option value="18K (75.0%)">18K (75.0%) - Diamond Jewelry</option>
                    <option value="14K (58.5%)">14K (58.5%) - Casted</option>
                  </>
                ) : (
                  <>
                    <option value="999 Fine Silver (99.9%)">999 Fine Silver (99.9%)</option>
                    <option value="925 Sterling Silver (92.5%)">925 Sterling Silver (92.5%)</option>
                    <option value="900 Coin Silver (90.0%)">900 Coin / Utensil (90.0%)</option>
                    <option value="800 Silver (80.0%)">800 Ornaments (80.0%)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-slate-700">
                  {isMarathi ? 'LTV गुणोत्तर मर्यादा (%)' : 'Loan to Value (LTV %)'}
                </label>
                <span className="text-xs font-black text-amber-600">{ltv}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="85"
                step="5"
                value={ltv}
                onChange={(e) => setLtv(Number(e.target.value))}
                className="w-full accent-amber-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>50% (Conservative)</span>
                <span>75% (RBI Standard)</span>
                <span>85% (High Risk)</span>
              </div>
            </div>
          </div>

          {/* Results Output */}
          <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-md space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-amber-400 border-b border-slate-800 pb-3 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>{isMarathi ? 'मूल्यांकन व कमाल कर्ज मर्यादा' : 'Valuation & Sanction Cap'}</span>
              </h3>

              <div className="mt-4 space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">{dict.goldItem.netWeight}</span>
                  <span className="font-extrabold text-white text-sm">{formatWeight(result.netWeight)}</span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">{isMarathi ? 'प्रभावी धातू दर' : 'Effective Metal Rate'}</span>
                  <span className="font-extrabold text-slate-200">
                    ₹{result.rateAppliedPerGram.toLocaleString('en-IN')}/g
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">{dict.goldItem.appraisedValue}</span>
                  <span className="font-extrabold text-amber-300 text-base">
                    {formatCurrency(result.estimatedMarketValue)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">{isMarathi ? 'सध्याची LTV मर्यादा' : 'Approved LTV Cap'}</span>
                  <span className="font-extrabold text-emerald-400">{ltv}%</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-gradient-to-r from-amber-600 to-amber-500 rounded-xl text-slate-950 font-black">
              <span className="text-[10px] uppercase tracking-wider block opacity-80">
                {dict.goldItem.maxLoanLimit}
              </span>
              <span className="text-xl md:text-2xl mt-0.5 block">{formatCurrency(result.maxLoanAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
