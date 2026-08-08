'use client';

// ========================================================
// SuvarnaLoan ERP - World Class Main Overview Dashboard
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/page.tsx
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Coins,
  TrendingUp,
  Package,
  ArrowUpRight,
  AlertTriangle,
  Plus,
  Calculator,
  Receipt,
  FileSpreadsheet,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Calendar,
  X,
  ShieldCheck,
  History,
  Activity,
  Clock,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import DashboardLayout from '../../components/DashboardLayout';
import { TouchCard } from '../../components/ui/TouchCard';
import { LoadingButton } from '../../components/ui/LoadingButton';
import { CreateGoldLoanModal } from '../../components/CreateGoldLoanModal';
import { db, clearDbCache, setupRealtimeSync } from '../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../lib/supabase/client';
import { DashboardMetrics, Loan, Customer, GoldItem } from '../../types';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import { calculateGoldValuation } from '../../lib/goldValuationEngine';
import { exportToExcel } from '../../lib/excel-export';
import { toast } from 'sonner';
import { useTranslation } from '../../providers/LanguageProvider';

const KARAT_COLORS = ['#f59e0b', '#d97706', '#b45309', '#78350f'];

export default function DashboardPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [goldItems, setGoldItems] = useState<GoldItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Quick Action Modal states
  const [newLoanModalOpen, setNewLoanModalOpen] = useState(false);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false);

  // Quick Valuation State
  const [calcWeight, setCalcWeight] = useState<number | string>('');
  const [calcStones, setCalcStones] = useState<number | string>('');
  const [calcKarat, setCalcKarat] = useState<string>('22K (91.6%)');
  const [calcResult, setCalcResult] = useState<any>(null);

  const loadData = async (bypassCache = false) => {
    if (bypassCache) clearDbCache();
    setLoading(true);
    try {
      const session = getSessionUser();
      const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
      if (!activeShopId) {
        setLoading(false);
        return;
      }

      const [mets, lnList, custList, goldList] = await Promise.all([
        db.getDashboardMetrics(activeShopId),
        db.getLoans(activeShopId),
        db.getCustomers(activeShopId),
        db.getGoldItems(activeShopId),
      ]);

      setMetrics(mets);
      setLoans(lnList);
      setCustomers(custList);
      setGoldItems(goldList);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
      toast.error('Unable to synchronize live dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen to real-time custom event
    const handleDbUpdate = () => {
      loadData(true);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-db-update', handleDbUpdate);
    }

    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    const unsubscribe = setupRealtimeSync(activeShopId, () => {
      loadData(true);
    });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-db-update', handleDbUpdate);
      }
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!metrics) return;
    const res = calculateGoldValuation({
      grossWeightGrams: Number(calcWeight) || 0,
      stoneWeightGrams: Number(calcStones) || 0,
      purityKarat: calcKarat,
      goldRatePerGram24K: metrics.goldRate24k,
      ltvPercentage: 75,
    });
    setCalcResult(res);
  }, [calcWeight, calcStones, calcKarat, metrics]);

  const filteredLoans = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return loans.filter((l) => {
      const custName = l.customer?.full_name || '';
      const custMobile = l.customer?.mobile_number || '';
      const num = l.loan_number || '';
      const matchesSearch = 
        custName.toLowerCase().includes(query) ||
        custMobile.toLowerCase().includes(query) ||
        num.toLowerCase().includes(query);
      
      const matchesStatus = statusFilter === 'ALL' ? l.status !== 'Closed' : l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loans, searchQuery, statusFilter]);

  const handleExportData = () => {
    const loansToExport = filteredLoans.length > 0 
      ? filteredLoans 
      : loans.filter(l => l.status === 'Active' || l.status === 'Overdue' || l.status !== 'Closed');

    if (!loansToExport.length) {
      toast.error('No active or overdue loan records available to export.');
      return;
    }

    const exportRows = loansToExport.map((l) => ({
      'Loan Number': l.loan_number || '',
      'Customer': l.customer?.full_name || 'N/A',
      'Mobile': l.customer?.mobile_number || 'N/A',
      'Loan Amount': l.loan_amount || 0,
      'Interest Rate': `${l.interest_rate || 0}%`,
      'Ornament': l.gold_item?.ornament_type || 'N/A',
      'Net Weight': `${l.gold_item?.net_weight || 0} g`,
      'Loan Date': l.loan_date || '',
      'Status': l.status || 'Active',
    }));

    const columnMap = isMarathi ? {
      'Loan Number': 'कर्ज क्रमांक',
      'Customer': 'ग्राहकाचे नाव',
      'Mobile': 'मोबाईल क्रमांक',
      'Loan Amount': 'कर्ज रक्कम (₹)',
      'Interest Rate': 'व्याजदर (%)',
      'Ornament': 'तारण सोन्याचे दागिने',
      'Net Weight': 'निव्वळ वजन (ग्रॅम)',
      'Loan Date': 'कर्ज दिनांक',
      'Status': 'स्थिती',
    } : undefined;

    exportToExcel(exportRows, `SuvarnaLoan_Register_${new Date().toISOString().split('T')[0]}`, 'Loans', columnMap);
    toast.success(isMarathi ? 'एक्सेल फाइल यशस्वीरित्या डाउनलोड झाली!' : 'Excel report exported successfully!');
  };

  if (loading || !metrics) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
            <div className="h-32 bg-slate-200 rounded-2xl"></div>
          </div>
          <div className="h-80 bg-slate-200 rounded-2xl"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Header & Quick Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <span>{dict.dashboard.title}</span>
              </h1>
              <div className="px-3 py-1 bg-amber-100/90 border border-amber-300 rounded-xl text-xs font-bold text-amber-950 flex items-center gap-1.5 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span>
                  {new Date().toLocaleDateString(isMarathi ? 'mr-IN' : 'en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              {dict.dashboard.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCalculatorModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center gap-1.5 transition-colors"
            >
              <Calculator className="w-4 h-4 text-amber-600" />
              <span>{dict.nav.goldValuation}</span>
            </button>

            <button
              onClick={() => setNewLoanModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl shadow-md gold-glow flex items-center gap-1.5 hover:brightness-105 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{dict.dashboard.issueLoanBtn}</span>
            </button>
          </div>
        </div>

        {/* Live Gold Rate Banner */}
        <div className="bg-slate-950 text-white rounded-2xl p-4 md:p-5 border border-amber-500/40 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 z-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center font-bold text-amber-400">
              <Coins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  {dict.dashboard.liveBullionTicker}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>{isMarathi ? 'थेट दर' : 'LIVE MARKET'}</span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-0.5">
                <span className="text-sm font-extrabold text-white">🟡 24K: ₹{metrics.goldRate24k}/g</span>
                <span className="text-slate-700">•</span>
                <span className="text-sm font-extrabold text-amber-200">🟡 22K: ₹{metrics.goldRate22k}/g</span>
                <span className="text-slate-700">•</span>
                <span className="text-sm font-extrabold text-slate-200">⚪ Fine Silver: ₹{metrics.silverRate1kg || 95000}/kg</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 z-10">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold border border-amber-500/30">
              {isMarathi ? 'मानक ७५% LTV मर्यादा' : 'Active Standard 75% LTV'}
            </span>
          </div>
        </div>

        {/* 4 Core Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <TouchCard className="border-l-4 border-l-amber-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{dict.dashboard.activeAum}</span>
              <Coins className="w-5 h-5 text-amber-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(metrics.totalPortfolioAum)}</div>
              <div className="flex items-center gap-1 mt-1 text-[11px] font-semibold text-emerald-600">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>{metrics.totalActiveLoansCount} {dict.dashboard.activeLoansCount}</span>
              </div>
            </div>
          </TouchCard>

          <TouchCard className="border-l-4 border-l-amber-600">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{dict.dashboard.goldInVault}</span>
              <Package className="w-5 h-5 text-amber-700" />
            </div>
            <div className="mt-2">
              <div className="text-xl font-extrabold text-slate-900 flex items-center justify-between">
                <span>🟡 {isMarathi ? 'सोने:' : 'Gold:'} {formatWeight(metrics.totalPledgedGoldWeightGrams)}</span>
              </div>
              <div className="text-xs font-bold text-slate-700 mt-1 flex items-center justify-between">
                <span>⚪ {isMarathi ? 'चांदी:' : 'Silver:'} {formatWeight(metrics.totalPledgedSilverWeightGrams || 0)}</span>
              </div>
              <div className="text-[10px] font-semibold text-slate-500 mt-1">
                {isMarathi ? 'शाखेच्या तिजोरी लॉकरमध्ये सुरक्षित' : 'Secured in Branch Locker Vaults'}
              </div>
            </div>
          </TouchCard>

          <TouchCard className="border-l-4 border-l-emerald-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{dict.dashboard.todayCollection}</span>
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(metrics.todayCollectionsAmount)}</div>
              <div className="text-[11px] font-semibold text-emerald-600 mt-1">
                {isMarathi ? 'आज काउंटरवर रोख व युपीआय जमा' : 'Recorded today at counter'}
              </div>
            </div>
          </TouchCard>

          <TouchCard className="border-l-4 border-l-rose-500">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{dict.dashboard.overdueLoansCount}</span>
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div className="mt-2">
              <div className="text-2xl font-extrabold text-rose-600">{metrics.overdueNpaCount} {isMarathi ? 'खाती' : 'Loans'}</div>
              <div className="text-[11px] font-semibold text-rose-500 mt-1">
                {isMarathi ? 'थकबाकी:' : 'Exposure:'} {formatCurrency(metrics.overdueNpaAmount)}
              </div>
            </div>
          </TouchCard>
        </div>

        {/* Graphical Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart 1: Disbursement vs Collection Trends */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isMarathi ? 'कर्ज वितरण व मासिक वसुली विश्लेषण' : 'Loan Disbursement vs Collection Trend'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isMarathi ? 'मासिक भांडवल प्रवाह (रुपये)' : 'Monthly capital flow analysis (INR)'}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-lg border border-amber-200">
                FY 2026
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.monthlyDisbursementVsCollection}>
                  <defs>
                    <linearGradient id="disbursedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip formatter={(value: any) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Amount']} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="disbursed"
                    name={isMarathi ? 'वितरित मुद्दल' : 'Loan Disbursed'}
                    stroke="#d97706"
                    fillOpacity={1}
                    fill="url(#disbursedGrad)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="collected"
                    name={isMarathi ? 'जमा व्याज' : 'Interest Collected'}
                    stroke="#059669"
                    fillOpacity={1}
                    fill="url(#collectedGrad)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Pledged Gold Karat Distribution */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {isMarathi ? 'शुद्धता कॅरेटनुसार तिजोरी साठा' : 'Vault Portfolio by Karat Purity'}
              </h3>
              <p className="text-[11px] text-slate-500">
                {isMarathi ? 'तारण दागिन्यांचे वजन वर्गीकरण' : 'Weight breakdown in pledged ornaments'}
              </p>
            </div>

            <div className="h-52 w-full my-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.portfolioKaratDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {metrics.portfolioKaratDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={KARAT_COLORS[index % KARAT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any, name: any, item: any) => [`${item.payload.weightGrams} g (${value})`, item.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5">
              {metrics.portfolioKaratDistribution.map((item, idx) => (
                <div key={item.name} className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: KARAT_COLORS[idx % KARAT_COLORS.length] }} />
                    <span>{item.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">{item.weightGrams} g</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Loans Register Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">{dict.loan.title}</h3>
              <p className="text-[11px] text-slate-500">{dict.loan.subtitle}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search input */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={isMarathi ? 'ग्राहक किंवा कर्ज शोधा...' : 'Search customer or loan #...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl w-48 md:w-56 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none"
              >
                <option value="ALL">{isMarathi ? 'सर्व सक्रिय व थकीत' : 'All Active & Overdue'}</option>
                <option value="Active">{isMarathi ? 'फक्त सक्रिय' : 'Active Only'}</option>
                <option value="Overdue">{isMarathi ? 'फक्त थकीत' : 'Overdue Only'}</option>
                <option value="Closed">{isMarathi ? 'बंद खाती' : 'Closed Loans Archive'}</option>
              </select>

              {/* Export button */}
              <button
                onClick={handleExportData}
                className="px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{dict.reports.exportExcel}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{dict.loan.contractNumber}</th>
                  <th className="py-3 px-4">{dict.loan.borrowerName}</th>
                  <th className="py-3 px-4">{dict.goldItem.ornamentType}</th>
                  <th className="py-3 px-4">{dict.goldItem.netWeight}</th>
                  <th className="py-3 px-4">{dict.loan.loanAmount}</th>
                  <th className="py-3 px-4">{dict.loan.interestRate}</th>
                  <th className="py-3 px-4">{dict.common.status}</th>
                  <th className="py-3 px-4 text-right">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {filteredLoans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      {dict.common.noRecords}
                    </td>
                  </tr>
                ) : (
                  filteredLoans.map((loan, idx) => (
                    <tr key={`${loan.id}-${loan.loan_number}-${idx}`} className="hover:bg-amber-50/30 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-amber-700">
                        <Link href={`/dashboard/loans/${loan.id}`} className="hover:underline">
                          {loan.loan_number}
                        </Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{loan.customer?.full_name}</div>
                        <div className="text-[10px] text-slate-400">{loan.customer?.mobile_number}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800">{loan.gold_item?.ornament_type}</span>
                        <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold">
                          {loan.gold_item?.purity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {formatWeight(loan.gold_item?.net_weight)}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        {formatCurrency(loan.loan_amount)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">
                        {loan.interest_rate}% / mo
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            loan.status === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : loan.status === 'Overdue'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {loan.status === 'Active' ? dict.common.active : loan.status === 'Overdue' ? dict.common.overdue : dict.common.closed}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Link
                          href={`/dashboard/loans/${loan.id}`}
                          className="px-3 py-1 text-[11px] font-bold bg-slate-100 hover:bg-amber-500 hover:text-white rounded-lg transition-colors text-slate-700 inline-block"
                        >
                          {dict.loan.viewDetails}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Calculator Modal */}
      {calculatorModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 font-sans">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Calculator className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">{dict.nav.goldValuation}</h3>
              </div>
              <button onClick={() => setCalculatorModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{dict.goldItem.grossWeight}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder={isMarathi ? 'एकूण वजन प्रविष्ट करा' : 'Enter gross weight'}
                    value={calcWeight}
                    onChange={(e) => setCalcWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{dict.goldItem.stoneWeight}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    placeholder="0.000"
                    value={calcStones}
                    onChange={(e) => setCalcStones(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{dict.goldItem.purity}</label>
                <select
                  value={calcKarat}
                  onChange={(e) => setCalcKarat(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-slate-50 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="24K (99.9%)">24K Fine Gold (99.9%)</option>
                  <option value="22K (91.6%)">22K Standard Hallmark (91.6%)</option>
                  <option value="18K (75.0%)">18K Jewellery Gold (75.0%)</option>
                  <option value="14K (58.5%)">14K Ornament Gold (58.5%)</option>
                </select>
              </div>

              {calcResult && (
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{dict.goldItem.netWeight}:</span>
                    <span className="font-extrabold text-slate-900">{formatWeight(calcResult.netWeight)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{isMarathi ? 'लागू केलेला सराफा दर:' : 'Applied Market Rate:'}</span>
                    <span className="font-extrabold text-slate-900">₹{calcResult.rateAppliedPerGram} / g</span>
                  </div>
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{dict.goldItem.appraisedValue}:</span>
                    <span className="font-extrabold text-slate-900">{formatCurrency(calcResult.estimatedMarketValue)}</span>
                  </div>
                  <div className="pt-2 border-t border-amber-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-amber-900 uppercase">{dict.goldItem.maxEligibleLoan}:</span>
                    <span className="text-lg font-black text-amber-700">{formatCurrency(calcResult.maxLoanAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 text-right">
              <button
                onClick={() => setCalculatorModalOpen(false)}
                className="px-5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
              >
                {dict.common.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create & Disburse Gold Loan Modal Component */}
      <CreateGoldLoanModal
        isOpen={newLoanModalOpen}
        onClose={() => setNewLoanModalOpen(false)}
        onSuccess={() => loadData()}
      />
    </DashboardLayout>
  );
}
