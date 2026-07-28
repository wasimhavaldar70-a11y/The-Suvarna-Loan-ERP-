'use client';

// ========================================================
// SuvarnaLoan ERP - Financial Reports & Audit Statements Hub
// Location: src/app/dashboard/reports/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import {
  FilePieChart,
  Download,
  Printer,
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
  PieChart
} from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { DashboardMetrics, Loan, Payment, Shop } from '../../../types';
import { formatCurrency, formatDate, formatWeight } from '../../../lib/utils';
import { calculateLoanFinancials } from '../../../lib/goldValuationEngine';
import { exportToExcel } from '../../../lib/excel-export';
import { printHTMLDocument } from '../../../lib/closureDocumentGenerator';
import { toast } from 'sonner';

export type ReportPeriod = '1_DAY' | '1_MONTH' | '3_MONTHS' | '6_MONTHS' | '1_YEAR' | 'ALL_TIME';

export default function ReportsPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>('1_MONTH');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) {
      setLoading(false);
      return;
    }
    const [shop, m, l] = await Promise.all([
      db.getShop(activeShopId),
      db.getDashboardMetrics(activeShopId),
      db.getLoans(activeShopId)
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

  // Filtered loans disbursed in period
  const periodLoans = loans.filter((loan) => {
    if (!periodStartDate) return true;
    const lDate = new Date(loan.loan_date);
    return lDate >= periodStartDate;
  });

  // Extract all payments occurred in period
  const allPeriodPayments: { payment: Payment; loan: Loan }[] = [];
  loans.forEach((loan) => {
    if (loan.payments && loan.payments.length > 0) {
      loan.payments.forEach((p) => {
        if (!periodStartDate) {
          allPeriodPayments.push({ payment: p, loan });
        } else {
          const pDate = new Date(p.payment_date);
          if (pDate >= periodStartDate) {
            allPeriodPayments.push({ payment: p, loan });
          }
        }
      });
    }
  });

  // Calculate period financial totals
  const periodDisbursedPrincipal = periodLoans.reduce((sum, l) => sum + l.loan_amount, 0);
  const periodInterestCollected = allPeriodPayments
    .filter((item) => item.payment.payment_type === 'Interest Payment' || item.payment.payment_type === 'Partial Payment')
    .reduce((sum, item) => sum + item.payment.amount, 0);

  const periodPrincipalRecovered = allPeriodPayments
    .filter((item) => item.payment.payment_type === 'Full Settlement' || item.payment.payment_type === 'Principal Part-Payment')
    .reduce((sum, item) => sum + item.payment.amount, 0);

  const totalPeriodCashReceived = periodInterestCollected + periodPrincipalRecovered;

  const periodPledgedGoldWeight = periodLoans.reduce((sum, l) => sum + (l.gold_item?.net_weight || 0), 0);
  const closedPeriodLoans = periodLoans.filter((l) => l.status === 'Closed');
  const periodReleasedGoldWeight = closedPeriodLoans.reduce((sum, l) => sum + (l.gold_item?.net_weight || 0), 0);

  // Consolidated ledger rows for search and table display
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

  const ledgerEntries: AuditLedgerEntry[] = [];

  // Add disbursals
  periodLoans.forEach((l) => {
    ledgerEntries.push({
      id: `disb-${l.id}`,
      date: l.loan_date,
      type: 'DISBURSAL',
      loan_number: l.loan_number,
      customer_name: l.customer?.full_name || 'Borrower Customer',
      amount: l.loan_amount,
      mode: 'Cash / Transfer',
      ornament: `${l.gold_item?.ornament_type || 'Gold Item'} (${formatWeight(l.gold_item?.net_weight || 0)})`,
      status: l.status,
    });
  });

  // Add payments
  allPeriodPayments.forEach(({ payment, loan }) => {
    let pType: AuditLedgerEntry['type'] = 'INTEREST_PAYMENT';
    if (payment.payment_type === 'Full Settlement') pType = 'LOAN_SETTLEMENT';
    else if (payment.payment_type === 'Principal Part-Payment') pType = 'PRINCIPAL_REPAYMENT';

    ledgerEntries.push({
      id: payment.id,
      date: payment.payment_date,
      type: pType,
      loan_number: loan.loan_number,
      customer_name: loan.customer?.full_name || 'Borrower Customer',
      amount: payment.amount,
      mode: payment.payment_method || 'Cash / UPI',
      ornament: `${loan.gold_item?.ornament_type || 'Gold Item'} (${formatWeight(loan.gold_item?.net_weight || 0)})`,
      status: payment.payment_type,
    });
  });

  // Sort ledger entries newest first
  ledgerEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Filter ledger by search query
  const filteredLedger = ledgerEntries.filter((e) => {
    const q = searchQuery.toLowerCase();
    return (
      e.customer_name.toLowerCase().includes(q) ||
      e.loan_number.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      e.mode.toLowerCase().includes(q)
    );
  });

  const getPeriodLabelText = (p: ReportPeriod) => {
    switch (p) {
      case '1_DAY':
        return 'Today (Daily Financial Report)';
      case '1_MONTH':
        return '1 Month Financial Report';
      case '3_MONTHS':
        return '3 Months (Quarterly Report)';
      case '6_MONTHS':
        return '6 Months (Half-Yearly Report)';
      case '1_YEAR':
        return '1 Year (Annual Audit Statement)';
      case 'ALL_TIME':
      default:
        return 'Complete All-Time Financial Ledger';
    }
  };

  // Export Period Financial Statement to Excel
  const handleExportPeriodExcel = () => {
    if (filteredLedger.length === 0) {
      toast.error('No ledger entries found for selected period');
      return;
    }

    const rows = filteredLedger.map((item) => ({
      'Date': formatDate(item.date),
      'Transaction Type': item.type,
      'Loan Account #': item.loan_number,
      'Customer Name': item.customer_name,
      'Amount (₹)': item.amount,
      'Payment Mode': item.mode,
      'Pledged Asset Details': item.ornament,
      'Status': item.status,
    }));

    const periodLabel = selectedPeriod.replace('_', '-');
    exportToExcel(rows, `SuvarnaLoan_Financial_Report_${periodLabel}_${new Date().toISOString().split('T')[0]}`);
    toast.success(`Exported ${getPeriodLabelText(selectedPeriod)} to Excel!`);
  };

  // Generate & Print Printable A4 Financial Audit Statement HTML
  const handlePrintAuditStatement = () => {
    const s = currentShop || {
      shop_name: 'Suvarna Gold Jewellers ERP',
      address: '108 Gold Bazaar, Zaveri Market, Mumbai',
      gstin: '27AAAAA0000A1Z5',
      license_number: 'GL-MUM-2024-884',
      mobile: '+91 98765 43210'
    };

    const periodTitle = getPeriodLabelText(selectedPeriod);

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Financial Audit Statement - ${periodTitle}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.4; }
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
      <div><span class="period-badge">OFFICIAL FINANCIAL AUDIT STATEMENT (${periodTitle.toUpperCase()})</span></div>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: 10px; color: #475569; margin-bottom: 20px; font-weight: 600;">
      <span><strong>Report Generated:</strong> ${formatDate(new Date().toISOString())}</span>
      <span><strong>Total Ledger Entries:</strong> ${filteredLedger.length}</span>
    </div>

    <div class="grid-4">
      <div class="card"><div class="lbl">Total Disbursed Principal</div><div class="val">${formatCurrency(periodDisbursedPrincipal)}</div></div>
      <div class="card"><div class="lbl">Interest Cash Collected</div><div class="val" style="color: #059669;">${formatCurrency(periodInterestCollected)}</div></div>
      <div class="card"><div class="lbl">Principal Recovered</div><div class="val" style="color: #0284c7;">${formatCurrency(periodPrincipalRecovered)}</div></div>
      <div class="card"><div class="lbl">Pledged Gold Pledged</div><div class="val">${formatWeight(periodPledgedGoldWeight)}</div></div>
    </div>

    <h3 style="font-size: 12px; font-weight: 800; color: #78350f; text-transform: uppercase; margin-bottom: 8px;">Consolidated Audit Ledger Breakdown</h3>
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Account #</th>
          <th>Customer Name</th>
          <th>Amount (₹)</th>
          <th>Mode</th>
          <th>Asset</th>
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
        <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Chartered Accountant / Managing Director</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    printHTMLDocument(htmlContent);
    toast.success('Sent Financial Audit Statement to browser print manager');
  };

  const periodOptions: { id: ReportPeriod; label: string; badgeText: string }[] = [
    { id: '1_DAY', label: '1 Day (Today)', badgeText: 'Daily Report' },
    { id: '1_MONTH', label: '1 Month', badgeText: 'Monthly' },
    { id: '3_MONTHS', label: '3 Months', badgeText: 'Quarterly' },
    { id: '6_MONTHS', label: '6 Months', badgeText: 'Half-Yearly' },
    { id: '1_YEAR', label: '1 Year', badgeText: 'Annual Audit' },
    { id: 'ALL_TIME', label: 'All Time', badgeText: 'Complete History' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-amber-600 to-amber-400 text-slate-950 rounded-2xl shadow-md gold-glow">
              <FilePieChart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Financial Reports & Audit Statements</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Complete financial ledgers & audit reporting for 1 Day, 1 Month, 3 Months, 6 Months & 1 Year
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={handlePrintAuditStatement}
              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-amber-400 font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
            >
              <Printer className="w-4 h-4 text-amber-400" />
              <span>Print A4 Audit Statement</span>
            </button>
            <button
              onClick={handleExportPeriodExcel}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Time-Period Filter Tabs */}
        <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-1.5 overflow-x-auto">
          <div className="px-3 text-xs font-black text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>Select Report Horizon:</span>
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${active ? 'bg-slate-950 text-amber-300' : 'bg-slate-200 text-slate-600'}`}>
                  {opt.badgeText}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Period Status Headline */}
        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-950">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span className="font-extrabold">Active Report Scope:</span>
            <span className="font-bold text-amber-900 underline">{getPeriodLabelText(selectedPeriod)}</span>
          </div>
          <span className="text-amber-800 font-mono text-[11px] font-bold">
            Total Ledger Transactions Recorded in Scope: {filteredLedger.length}
          </span>
        </div>

        {/* Financial KPI Summary Cards Grid for Selected Period */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Sanctioned Disbursals</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(periodDisbursedPrincipal)}</div>
              <span className="text-[11px] font-semibold text-slate-500">{periodLoans.length} Loans Disbursed</span>
            </div>
            <div className="p-3 bg-slate-100 text-slate-700 rounded-2xl">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-emerald-600 tracking-wider">Interest Cash Income</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(periodInterestCollected)}</div>
              <span className="text-[11px] font-semibold text-emerald-600">Counter Dues Collected</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200/60">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-sky-600 tracking-wider">Principal Recovered</span>
              <div className="text-2xl font-black text-sky-700 mt-1">{formatCurrency(periodPrincipalRecovered)}</div>
              <span className="text-[11px] font-semibold text-sky-600">{closedPeriodLoans.length} Loans Fully Settled</span>
            </div>
            <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl border border-sky-200/60">
              <FileCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-amber-600 tracking-wider">Pledged Gold Movement</span>
              <div className="text-2xl font-black text-amber-800 mt-1">{formatWeight(periodPledgedGoldWeight)}</div>
              <span className="text-[11px] font-semibold text-amber-600">Released: {formatWeight(periodReleasedGoldWeight)}</span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200/60">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Consolidated Period Ledger Table Section */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <span>Period Financial Audit Ledger</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Detailed transaction log of all loan disbursals, interest collections, and principal settlements
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ledger by customer, loan # or mode..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Transaction Type</th>
                  <th className="py-3.5 px-4">Loan Account #</th>
                  <th className="py-3.5 px-4">Customer Name</th>
                  <th className="py-3.5 px-4">Amount (₹)</th>
                  <th className="py-3.5 px-4">Payment Mode</th>
                  <th className="py-3.5 px-4 text-right">Pledged Gold Asset</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                      <FilePieChart className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No financial transactions recorded in the selected period.
                    </td>
                  </tr>
                ) : (
                  filteredLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 text-slate-500 font-mono font-medium whitespace-nowrap">
                        {formatDate(item.date)}
                      </td>

                      <td className="py-3.5 px-4 font-bold">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            item.type === 'DISBURSAL'
                              ? 'bg-slate-100 text-slate-800 border-slate-200'
                              : item.type === 'INTEREST_PAYMENT'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : 'bg-sky-100 text-sky-800 border-sky-200'
                          }`}
                        >
                          {item.type.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{item.loan_number}</td>

                      <td className="py-3.5 px-4 font-bold text-slate-800">{item.customer_name}</td>

                      <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                        {formatCurrency(item.amount)}
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-600">{item.mode}</td>

                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">{item.ornament}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
