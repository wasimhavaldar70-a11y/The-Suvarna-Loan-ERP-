'use client';

// ========================================================
// SuvarnaLoan ERP - Standalone Gold Valuation Engine Tool
// Location: src/app/dashboard/valuation/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Calculator, Coins, ShieldCheck, Scale, AlertCircle } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { calculateGoldValuation } from '../../../lib/goldValuationEngine';
import { formatCurrency } from '../../../lib/utils';

import { fetchLiveMetalRates } from '../../../lib/liveMetalRatesApi';

export default function ValuationPage() {
  const [metalType, setMetalType] = useState<'Gold' | 'Silver'>('Gold');
  const [rate24k, setRate24k] = useState(7650);
  const [silverRatePerGram, setSilverRatePerGram] = useState(95);
  const [grossWeight, setGrossWeight] = useState(25.5);
  const [stoneWeight, setStoneWeight] = useState(1.5);
  const [karat, setKarat] = useState('22K (91.6%)');
  const [ltv, setLtv] = useState(75);
  const [loadingLive, setLoadingLive] = useState(false);

  useEffect(() => {
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) return;
    db.getShop(activeShopId).then((s) => {
      if (s) {
        if (s.use_live_rates) {
          fetchLiveMetalRates().then((live) => {
            setRate24k(live.gold24kPerGram);
            setSilverRatePerGram(live.silverPerGram);
          });
        } else {
          setRate24k(s.gold_rate_24k || 7650);
          setSilverRatePerGram(s.silver_rate_per_gram || Number(((s.silver_rate_1kg || 95000) / 1000).toFixed(2)));
        }
      }
    });
  }, []);

  const handleSyncLive = async () => {
    setLoadingLive(true);
    const live = await fetchLiveMetalRates(true);
    setRate24k(live.gold24kPerGram);
    setSilverRatePerGram(live.silverPerGram);
    setLoadingLive(false);
  };

  const result = calculateGoldValuation({
    metalType,
    grossWeightGrams: grossWeight,
    stoneWeightGrams: stoneWeight,
    purityKarat: karat,
    goldRatePerGram24K: rate24k,
    silverRatePerGram,
    ltvPercentage: ltv,
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-amber-600" />
            <span>Precision Gold & Silver Loan Valuation Engine</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Calculate net metal weight, purity grade adjustments, market value & maximum loan limit
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
              Valuation Parameters
            </h3>

            {/* Metal Type Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Metal Type</label>
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
                  🟡 Gold Metal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMetalType('Silver');
                    setKarat('925 Sterling Silver (92.5%)');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                    metalType === 'Silver'
                      ? 'bg-slate-800 text-slate-100 border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  ⚪ Silver Metal
                </button>
              </div>
            </div>

            {metalType === 'Gold' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Live 24K Gold Rate (₹/g)</label>
                <input
                  type="number"
                  value={rate24k}
                  onChange={(e) => setRate24k(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Live Fine Silver Rate (₹/g)</label>
                <input
                  type="number"
                  value={silverRatePerGram}
                  onChange={(e) => setSilverRatePerGram(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Equivalent to ₹{formatCurrency(silverRatePerGram * 1000)} / kg
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gross Weight (g)</label>
                <input
                  type="number"
                  step="0.001"
                  value={grossWeight}
                  onChange={(e) => setGrossWeight(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Stone Deduction (g)</label>
                <input
                  type="number"
                  step="0.001"
                  value={stoneWeight}
                  onChange={(e) => setStoneWeight(Number(e.target.value))}
                  className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Purity & Quality Grade</label>
              <select
                value={karat}
                onChange={(e) => setKarat(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {metalType === 'Silver' ? (
                  <>
                    <option value="999 Fine Silver (99.9%)">999 Fine Silver (99.9%)</option>
                    <option value="925 Sterling Silver (92.5%)">925 Sterling Silver (92.5%)</option>
                    <option value="900 Coin Silver (90.0%)">900 Coin / Utensil Silver (90.0%)</option>
                    <option value="800 Silver (80.0%)">800 Ornaments Silver (80.0%)</option>
                  </>
                ) : (
                  <>
                    <option value="24K (99.9%)">24K Fine Gold (99.9%)</option>
                    <option value="22K (91.6%)">22K Standard Hallmark (91.6%)</option>
                    <option value="20K (83.3%)">20K Gold (83.3%)</option>
                    <option value="18K (75.0%)">18K Jewellery Gold (75.0%)</option>
                    <option value="14K (58.5%)">14K Ornament Gold (58.5%)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">LTV Limit Ratio (%)</label>
              <input
                type="number"
                value={ltv}
                onChange={(e) => setLtv(Number(e.target.value))}
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Results Summary */}
          <div className="bg-slate-950 text-white rounded-2xl p-6 shadow-xl border border-amber-500/30 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Valuation Results ({metalType})</span>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md">
                  RBI Compliant Engine
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Net {metalType} Weight:</span>
                  <span className="text-sm font-extrabold text-white">{result.netWeight} grams</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Pure {metalType} Content:</span>
                  <span className="text-sm font-extrabold text-amber-400">{result.pureGoldWeightGrams} grams</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300">
                  <span>Applied Rate per Gram:</span>
                  <span className="text-sm font-extrabold text-white">₹{result.rateAppliedPerGram} / gram</span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-300 pt-2 border-t border-slate-800">
                  <span>Estimated Ornament Market Value:</span>
                  <span className="text-base font-extrabold text-amber-300">{formatCurrency(result.estimatedMarketValue)}</span>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-800 mt-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Maximum Eligible Loan Disbursal ({result.ltvPercentage}% LTV)
              </span>
              <div className="text-3xl font-black text-amber-400 gold-glow">{formatCurrency(result.maxLoanAmount)}</div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
