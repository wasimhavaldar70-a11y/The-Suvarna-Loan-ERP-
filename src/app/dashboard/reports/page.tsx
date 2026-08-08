'use client';

// ========================================================
// SuvarnaLoan ERP - Financial Reports & Audit Statements Hub
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/reports/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import {
  FilePieChart,
  Download,
  Printer,
  FileSpreadsheet,
  Coins,
  AlertTriangle,
  Package,
  Calendar,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  RefreshCw,
  Clock,
  Building2,
  FileCheck,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db, clearDbCache } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { DashboardMetrics, Loan, Payment, Shop } from '../../../types';
import { formatCurrency, formatDate, formatWeight } from '../../../lib/utils';
import { calculateLoanFinancials } from '../../../lib/goldValuationEngine';
import { exportToExcel } from '../../../lib/excel-export';
import { printHTMLDocument } from '../../../lib/closureDocumentGenerator';
import { toast } from 'sonner';
import { useTranslation } from '../../../providers/LanguageProvider';

export type ReportPeriod = '1_DAY' | '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR' | 'ALL_TIME';

interface AuditLedgerEntry {
  id: string;
  date: string;
  type: 'DISBURSAL' | 'INTEREST_PAYMENT' | 'PRINCIPAL_REPAYMENT' | 'LOAN_SETTLEMENT';
  loan_number: string;
  customer_name: string;
  amount: number;
  mode: string;
  ornament: string;
  status: string;
}

export default function ReportsPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('1_MONTH');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadData();

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'loans' || e.detail.table === 'payments' || e.detail.table === 'loan_disbursements' || e.detail.table === 'shops') {
        loadData();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', () => loadData());
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', () => loadData());
      }
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    clearDbCache();
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) {
      setLoading(false);
      return;
    }
    const [shop, m, l] = await Promise.all([
      db.getShop(activeShopId),
      db.getDashboardMetrics(activeShopId),
      db.getLoans(activeShopId),
    ]);
    if (shop) setCurrentShop(shop);
    setMetrics(m);
    setLoans(l);
    setLoading(false);
  };

  // Helper to filter dates by selected period
  const getPeriodStartDate = (period: ReportPeriod): Date | null => {
    const now = new Date();
    switch (period) {
      case '1_DAY': {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        return d;
      }
      case '1_MONTH': {
        const d = new Date(now);
        d.setMonth(now.getMonth() - 1);
        return d;
      }
      case '3_MONTHS': {
        const d = new Date(now);
        d.setMonth(now.getMonth() - 3);
        return d;
      }
      case '6_MONTHS': {
        const d = new Date(now);
        d.setMonth(now.getMonth() - 6);
        return d;
      }
      case '1_YEAR': {
        const d = new Date(now);
        d.setFullYear(now.getFullYear() - 1);
        return d;
      }
      case 'ALL_TIME':
      default:
        return null;
    }
  };

  const periodStartDate = getPeriodStartDate(selectedPeriod);

  // Consolidated audit ledger
  const rawLedger: AuditLedgerEntry[] = [];

  loans.forEach((loan) => {
    // 1. Initial Disbursal
    rawLedger.push({
      id: `disb-${loan.id}`,
      date: loan.loan_date,
      type: 'DISBURSAL',
      loan_number: loan.loan_number,
      customer_name: loan.customer?.full_name || 'Customer',
      amount: loan.loan_amount,
      mode: 'Cash / Bank',
      ornament: `${loan.gold_item?.ornament_type || 'Gold Item'} (${loan.gold_item?.purity || '22K'})`,
      status: loan.status,
    });

    // 2. Multi-tranche top-ups if any
    if (Array.isArray(loan.disbursements)) {
      loan.disbursements.forEach((d) => {
        if (d.disbursement_number && d.disbursement_number > 1) {
          rawLedger.push({
            id: `topup-${d.id}`,
            date: d.disbursement_date,
            type: 'DISBURSAL',
            loan_number: `${loan.loan_number} (Tranche #${d.disbursement_number})`,
            customer_name: loan.customer?.full_name || 'Customer',
            amount: d.amount,
            mode: d.payment_method || 'Cash',
            ornament: isMarathi ? 'त्याच सोन्यावर अतिरिक्त टॉप-अप' : 'Top-Up on Pledged Item',
            status: d.status || 'Active',
          });
        }
      });
    }

    // 3. Payments (Interest & Principal Repayments)
    if (Array.isArray(loan.payments)) {
      loan.payments.forEach((p) => {
        let pType: AuditLedgerEntry['type'] = 'INTEREST_PAYMENT';
        if (p.payment_type === 'Principal Part-Payment') pType = 'PRINCIPAL_REPAYMENT';
        else if (p.payment_type === 'Full Settlement') pType = 'LOAN_SETTLEMENT';

        rawLedger.push({
          id: p.id,
          date: p.payment_date,
          type: pType,
          loan_number: loan.loan_number,
          customer_name: loan.customer?.full_name || 'Customer',
          amount: p.amount,
          mode: p.payment_method || 'UPI',
          ornament: p.receipt_number || 'Receipt',
          status: 'Collected',
        });
      });
    }
  });

  // Sort descending by date
  rawLedger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter ledger by period & search query
  const filteredLedger = rawLedger.filter((entry) => {
    if (periodStartDate) {
      const entryDate = new Date(entry.date);
      if (entryDate < periodStartDate) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        entry.customer_name.toLowerCase().includes(q) ||
        entry.loan_number.toLowerCase().includes(q) ||
        entry.ornament.toLowerCase().includes(q) ||
        entry.type.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Period Aggregated Calculations
  const periodDisbursedPrincipal = filteredLedger
    .filter((e) => e.type === 'DISBURSAL')
    .reduce((sum, e) => sum + e.amount, 0);

  const periodInterestCollected = filteredLedger
    .filter((e) => e.type === 'INTEREST_PAYMENT')
    .reduce((sum, e) => sum + e.amount, 0);

  const periodPrincipalRecovered = filteredLedger
    .filter((e) => e.type === 'PRINCIPAL_REPAYMENT' || e.type === 'LOAN_SETTLEMENT')
    .reduce((sum, e) => sum + e.amount, 0);

  const periodPledgedGoldWeight = loans
    .filter((l) => {
      if (!periodStartDate) return true;
      return new Date(l.loan_date) >= periodStartDate;
    })
    .reduce((sum, l) => sum + (l.gold_item?.net_weight || 0), 0);

  // Period Excel Export
  const handleExportPeriodExcel = () => {
    if (filteredLedger.length === 0) {
      toast.error(isMarathi ? 'डाउनलोड करण्यासाठी कोणत्याही नोंदी उपलब्ध नाहीत.' : 'No audit ledger records found for this period.');
      return;
    }

    const rows = filteredLedger.map((e) => ({
      'Date': e.date,
      'Transaction Type': e.type,
      'Loan #': e.loan_number,
      'Customer Name': e.customer_name,
      'Amount (₹)': e.amount,
      'Payment Mode': e.mode,
      'Asset / Reference': e.ornament,
      'Status': e.status,
    }));

    const columnMap = isMarathi ? {
      'Date': 'दिनांक',
      'Transaction Type': 'व्यवहार प्रकार',
      'Loan #': 'कर्ज खाते क्रमांक',
      'Customer Name': 'ग्राहकाचे नाव',
      'Amount (₹)': 'रक्कम (₹)',
      'Payment Mode': 'भरणा पद्धत',
      'Asset / Reference': 'दागिना / पावती संदर्भ',
      'Status': 'स्थिती',
    } : undefined;

    exportToExcel(rows, `Audit_Report_${selectedPeriod}_${new Date().toISOString().split('T')[0]}`, 'Audit_Ledger', columnMap);
    toast.success(isMarathi ? 'ऑडिट अहवाल एक्सेलमध्ये यशस्वीरित्या डाउनलोड झाला!' : `Exported ${rows.length} audit entries to Excel!`);
  };

  // Statutory Financial Statement Print Document Generator
  const handlePrintAuditStatement = () => {
    const s = currentShop || {
      shop_name: 'Suvarna Gold Jewellers',
      address: 'Shop #4, Zaveri Bazaar, Mumbai',
      gstin: '27AAAAA0000A1Z5',
      license_number: 'GL-MUM-884',
    };

    const periodTitle = periodOptions.find((p) => p.id === selectedPeriod)?.label || selectedPeriod;

    const htmlContent = `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="utf-8">
  <title>SuvarnaLoan - Financial Audit Statement (${periodTitle})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Noto Sans Devanagari', 'Outfit', 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.4; }
    .container { border: 2px solid #cbd5e1; border-radius: 16px; padding: 30px; background: #ffffff; }
    .header { text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: 900; color: #78350f; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
    .period-badge { display: inline-block; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 4px 16px; border-radius: 20px; font-size: 12px; font-weight: 800; margin-top: 10px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 25px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; text-align: center; }
    .lbl { font-size: 9px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .val { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    .table th, .table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    .table th { background: #f1f5f9; color: #475569; font-weight: 800; text-transform: uppercase; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">👑 ${s.shop_name}</h1>
      <div class="subtitle">${s.address} • GSTIN: ${s.gstin || 'N/A'} • License: ${s.license_number || 'GL-MUM-884'}</div>
      <div><span class="period-badge">${isMarathi ? `अधिकृत आर्थिक ऑडिट विवरणपत्र (${periodTitle})` : `OFFICIAL FINANCIAL AUDIT STATEMENT (${periodTitle.toUpperCase()})`}</span></div>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-bottom: 20px; font-weight: 600;">
      <span><strong>${isMarathi ? 'अहवाल तयार दिनांक:' : 'Report Generated:'}</strong> ${formatDate(new Date().toISOString())}</span>
      <span><strong>${isMarathi ? 'एकूण नोंदी:' : 'Total Ledger Entries:'}</strong> ${filteredLedger.length}</span>
    </div>

    <div class="grid-4">
      <div class="card"><div class="lbl">${isMarathi ? 'एकूण वितरित मुद्दल' : 'Total Disbursed Principal'}</div><div class="val">${formatCurrency(periodDisbursedPrincipal)}</div></div>
      <div class="card"><div class="lbl">${isMarathi ? 'जमा झालेले व्याज' : 'Interest Cash Collected'}</div><div class="val" style="color: #059669;">${formatCurrency(periodInterestCollected)}</div></div>
      <div class="card"><div class="lbl">${isMarathi ? 'वसूल झालेले मुद्दल' : 'Principal Recovered'}</div><div class="val" style="color: #0284c7;">${formatCurrency(periodPrincipalRecovered)}</div></div>
      <div class="card"><div class="lbl">${isMarathi ? 'तारण सोने निव्वळ वजन' : 'Pledged Gold Pledged'}</div><div class="val">${formatWeight(periodPledgedGoldWeight)}</div></div>
    </div>

    <h3 style="font-size: 12px; font-weight: 800; color: #78350f; text-transform: uppercase; margin-bottom: 8px;">
      ${isMarathi ? 'एकत्रित आर्थिक ऑडिट खातेवही तपशील' : 'Consolidated Audit Ledger Breakdown'}
    </h3>
    <table class="table">
      <thead>
        <tr>
          <th>${dict.common.date}</th>
          <th>${isMarathi ? 'व्यवहार प्रकार' : 'Type'}</th>
          <th>${dict.loan.contractNumber}</th>
          <th>${dict.loan.borrowerName}</th>
          <th>${dict.common.total} (₹)</th>
          <th>${dict.repayment.paymentMethod}</th>
          <th>${dict.goldItem.ornamentType}</th>
        </tr>
      </thead>
      <tbody>
        ${filteredLedger
          .map(
            (e) => `
          <tr>
            <td>${formatDate(e.date)}</td>
            <td><strong>${e.type}</strong></td>
            <td>${e.loan_number}</td>
            <td>${e.customer_name}</td>
            <td style="font-weight: 800;">${formatCurrency(e.amount)}</td>
            <td>${e.mode}</td>
            <td>${e.ornament}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>

    <div class="footer">
      <div style="font-size: 9px; color: #94a3b8;">
        SuvarnaLoan ERP Official Financial Statement Document.<br/>Generated under Statutory Accounting Protocol.
      </div>
      <div style="text-align: right;">
        <div style="border-bottom: 1.5px solid #0f172a; width: 160px; margin-left: auto; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${isMarathi ? 'अधिकृत स्वाक्षरी / व्यवस्थापकीय संचालक' : 'Chartered Accountant / Managing Director'}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    printHTMLDocument(htmlContent);
    toast.success(isMarathi ? 'आर्थिक विवरणपत्र मुद्रणासाठी तयार केले' : 'Sent Financial Audit Statement to browser print manager');
  };

  const periodOptions: { id: ReportPeriod; label: string; badgeText: string }[] = isMarathi ? [
    { id: '1_DAY', label: '१ दिवस (आज)', badgeText: 'दैनिक अहवाल' },
    { id: '1_MONTH', label: '१ महिना', badgeText: 'मासिक' },
    { id: '3_MONTHS', label: '३ महिने', badgeText: 'त्रैमासिक' },
    { id: '6_MONTHS', label: '६ महिने', badgeText: 'सहामाही' },
    { id: '1_YEAR', label: '१ वर्ष', badgeText: 'वार्षिक ऑडिट' },
    { id: 'ALL_TIME', label: 'सर्व कालावधी', badgeText: 'संपूर्ण इतिहास' },
  ] : [
    { id: '1_DAY', label: '1 Day (Today)', badgeText: 'Daily Report' },
    { id: '1_MONTH', label: '1 Month', badgeText: 'Monthly' },
    { id: '3_MONTHS', label: '3 Months', badgeText: 'Quarterly' },
    { id: '6_MONTHS', label: '6 Months', badgeText: 'Half-Yearly' },
    { id: '1_YEAR', label: '1 Year', badgeText: 'Annual Audit' },
    { id: 'ALL_TIME', label: 'All Time', badgeText: 'Complete History' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 rounded-2xl shadow-md gold-glow">
              <FilePieChart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{dict.reports.title}</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {dict.reports.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handlePrintAuditStatement}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-rose-600/20 transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>{dict.reports.printReport}</span>
            </button>
            <button
              onClick={handleExportPeriodExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 text-white" />
              <span>{dict.reports.exportExcel}</span>
            </button>
          </div>
        </div>

        {/* Time-Period Filter Tabs */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto">
          <div className="px-3 text-xs font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>{isMarathi ? 'अहवाल कालावधी निवडा:' : 'Select Report Horizon:'}</span>
          </div>

          {periodOptions.map((opt) => {
            const active = selectedPeriod === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setSelectedPeriod(opt.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                  active
                    ? 'bg-amber-500 text-slate-950 shadow-md font-extrabold gold-glow ring-2 ring-amber-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-extrabold uppercase ${
                    active ? 'bg-slate-950 text-amber-300' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {opt.badgeText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Aggregated Financial Cards for Selected Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>{isMarathi ? 'कालावधीत वितरित मुद्दल' : 'Period Disbursed Principal'}</span>
              <Coins className="w-4 h-4 text-amber-400" />
            </div>
            <strong className="text-xl md:text-2xl font-black text-amber-300 mt-2 block">
              {formatCurrency(periodDisbursedPrincipal)}
            </strong>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {isMarathi ? 'नवीन कर्ज व टॉप-अप वितरण' : 'Fresh Loans & Top-Up Disbursements'}
            </span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>{isMarathi ? 'जमा झालेले व्याज उत्पन्न' : 'Period Interest Income'}</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <strong className="text-xl md:text-2xl font-black text-emerald-400 mt-2 block">
              {formatCurrency(periodInterestCollected)}
            </strong>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {isMarathi ? 'काऊंटरवर रोख व यूपीआय व्याज जमा' : 'Direct Cash & UPI Interest Credits'}
            </span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>{isMarathi ? 'वसूल झालेले मुद्दल' : 'Principal Recovered'}</span>
              <RefreshCw className="w-4 h-4 text-cyan-400" />
            </div>
            <strong className="text-xl md:text-2xl font-black text-cyan-300 mt-2 block">
              {formatCurrency(periodPrincipalRecovered)}
            </strong>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {isMarathi ? 'अंशतः परतफेड व खाते बंद भरणा' : 'Part-Payments & Loan Closures'}
            </span>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 text-white shadow-md relative overflow-hidden">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold uppercase tracking-wider">
              <span>{isMarathi ? 'तारण सोन्याचे निव्वळ वजन' : 'Pledged Collateral Gold'}</span>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <strong className="text-xl md:text-2xl font-black text-white mt-2 block">
              {formatWeight(periodPledgedGoldWeight)}
            </strong>
            <span className="text-[10px] text-slate-400 mt-1 block">
              {isMarathi ? 'तिजोरीत सुरक्षित ठेवलेले दागिने' : 'Vault Locker Safe Custody'}
            </span>
          </div>
        </div>

        {/* Audit Search Bar & Full Transaction Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4">
          <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                {isMarathi ? 'एकत्रित आर्थिक ऑडिट खातेवही व व्यवहार' : 'Consolidated Audit Ledger & Transaction Manifest'}
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                {isMarathi ? `${filteredLedger.length} व्यवहारांची संपूर्ण नोंद` : `Audited trail of ${filteredLedger.length} cashflows across loans, disbursements & repayments`}
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isMarathi ? 'ग्राहक, कर्ज #, किंवा व्यवहार शोधा...' : 'Search by customer, loan #, or type...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{dict.common.date}</th>
                  <th className="py-3 px-4">{isMarathi ? 'व्यवहार प्रकार' : 'Transaction Type'}</th>
                  <th className="py-3 px-4">{dict.loan.contractNumber}</th>
                  <th className="py-3 px-4">{dict.loan.borrowerName}</th>
                  <th className="py-3 px-4">{dict.repayment.paymentMethod}</th>
                  <th className="py-3 px-4">{isMarathi ? 'दागिना / पावती' : 'Asset / Voucher'}</th>
                  <th className="py-3 px-4 text-right">{dict.common.total} (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {dict.common.loading}
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {dict.common.noRecords}
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((entry) => {
                    const isCredit = entry.type === 'INTEREST_PAYMENT' || entry.type === 'PRINCIPAL_REPAYMENT' || entry.type === 'LOAN_SETTLEMENT';
                    return (
                      <tr key={entry.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4 text-slate-600 font-semibold">{formatDate(entry.date)}</td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                              entry.type === 'DISBURSAL'
                                ? 'bg-amber-100 text-amber-900 border-amber-300'
                                : entry.type === 'INTEREST_PAYMENT'
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : entry.type === 'PRINCIPAL_REPAYMENT'
                                ? 'bg-cyan-100 text-cyan-900 border-cyan-300'
                                : 'bg-purple-100 text-purple-900 border-purple-300'
                            }`}
                          >
                            {entry.type === 'DISBURSAL'
                              ? (isMarathi ? 'कर्ज वितरण' : 'Disbursal')
                              : entry.type === 'INTEREST_PAYMENT'
                              ? (isMarathi ? 'व्याज जमा' : 'Interest Paid')
                              : entry.type === 'PRINCIPAL_REPAYMENT'
                              ? (isMarathi ? 'मुद्दल परतफेड' : 'Principal Paid')
                              : (isMarathi ? 'खाते समाप्ती' : 'Settlement')
                            }
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{entry.loan_number}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">{entry.customer_name}</td>
                        <td className="py-3.5 px-4 text-slate-600">{entry.mode}</td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{entry.ornament}</td>
                        <td className={`py-3.5 px-4 text-right font-black ${isCredit ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {isCredit ? '+' : ''}{formatCurrency(entry.amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
