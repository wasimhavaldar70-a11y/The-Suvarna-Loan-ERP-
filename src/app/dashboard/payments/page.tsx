'use client';

// ========================================================
// SuvarnaLoan ERP - Payments & Receipts Ledger
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/payments/page.tsx
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Receipt, Search, FileSpreadsheet, Printer, Download, Coins, TrendingUp, CheckCircle2, AlertCircle } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db, clearDbCache } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Payment, Loan } from '../../../types';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';
import { printSinglePaymentReceiptPDF } from '../../../lib/closureDocumentGenerator';
import { exportToPDF } from '../../../lib/pdf-export';
import { toast } from 'sonner';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function PaymentsPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 150);
    return () => clearTimeout(timer);
  }, [search]);

  const loadData = async (isInitial = false) => {
    if (isInitial && payments.length === 0 && loans.length === 0) {
      setLoading(true);
    }
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) {
      setLoading(false);
      return;
    }
    const [pmts, allLoans] = await Promise.all([
      db.getPayments(activeShopId),
      db.getLoans(activeShopId),
    ]);
    setPayments(pmts);
    setLoans(allLoans);
    setLoading(false);
  };

  useEffect(() => {
    loadData(true);

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'payments' || e.detail.table === 'loans') {
        loadData(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', () => loadData(false));
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', () => loadData(false));
      }
    };
  }, []);

  // Summary Metrics Calculation across all payments and loans
  const summaryMetrics = useMemo(() => {
    const totalDisbursed = loans.reduce((sum, l) => sum + (Number(l.total_disbursed || l.loan_amount) || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalPrincipalPaid = payments.reduce((sum, p) => {
      const pAmt = Number(p.amount) || 0;
      return sum + (p.payment_type === 'Interest Payment' ? 0 : pAmt);
    }, 0);
    const totalOutstanding = loans
      .filter((l) => l.status !== 'Closed')
      .reduce((sum, l) => sum + (Number(l.total_balance_due ?? l.total_principal_outstanding ?? l.loan_amount) || 0), 0);
    const totalReceipts = payments.length;

    return {
      totalDisbursed,
      totalPaid,
      totalPrincipalPaid,
      totalOutstanding,
      totalReceipts,
    };
  }, [loans, payments]);

  const filtered = useMemo(() => {
    const query = debouncedSearch.toLowerCase().trim();
    if (!query) return payments;
    return payments.filter(
      (p) =>
        (p.receipt_number && p.receipt_number.toLowerCase().includes(query)) ||
        (p.payment_type && p.payment_type.toLowerCase().includes(query)) ||
        (p.payment_method && p.payment_method.toLowerCase().includes(query)) ||
        (p.loan?.loan_number && p.loan.loan_number.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query))
    );
  }, [payments, debouncedSearch]);

  const handleExport = () => {
    const rows = filtered.map((p) => ({
      'Receipt #': p.receipt_number,
      'Payment Date': p.payment_date,
      'Loan Number': p.loan?.loan_number,
      'Payment Type': p.payment_type,
      'Method': p.payment_method,
      'Amount Paid (₹)': p.amount,
      'Notes': p.notes,
    }));

    const columnMap = isMarathi ? {
      'Receipt #': 'पावती क्रमांक',
      'Payment Date': 'भरणा दिनांक',
      'Loan Number': 'कर्ज खाते क्रमांक',
      'Payment Type': 'भरणा प्रकार',
      'Method': 'भरणा पद्धत',
      'Amount Paid (₹)': 'भरणा रक्कम (₹)',
      'Notes': 'नोंदी व शेरा',
    } : undefined;

    exportToExcel(rows, `Payments_Ledger_${new Date().toISOString().split('T')[0]}`, 'Payments', columnMap);
    toast.success(isMarathi ? 'पावती नोंदवही एक्सेलमध्ये डाउनलोड झाली!' : 'Exported payments ledger to Excel!');
  };

  const handleExportPDF = () => {
    const session = getSessionUser();
    exportToPDF({
      title: isMarathi ? 'कर्ज परतफेड व पावती नोंदवही' : 'Payments & Receipts Ledger Report',
      subtitle: isMarathi ? 'काऊंटर रोख भरणा, व्याज जमा व संपूर्ण परतफेड पावत्या' : 'Audit Log of Counter Payments, Interest Credits & Settlement Receipts',
      columns: [
        dict.repayment.receiptNumber,
        dict.common.date,
        dict.loan.contractNumber,
        dict.repayment.repaymentPurpose,
        dict.repayment.paymentMethod,
        dict.common.total,
        dict.common.notes,
      ],
      rows: filtered.map((p) => [
        p.receipt_number || '',
        formatDate(p.payment_date) || '',
        p.loan?.loan_number || '',
        p.payment_type || '',
        p.payment_method || '',
        formatCurrency(p.amount || 0),
        p.notes || '-',
      ]),
      shop: session?.shop,
      filename: `Payments_Ledger_${new Date().toISOString().split('T')[0]}`,
    });
    toast.success(isMarathi ? 'पावती नोंदवही PDF तयार झाली!' : 'Generated Payments PDF Report!');
  };

  const handlePrintReceipt = (payment: Payment) => {
    const session = getSessionUser();
    const targetLoan = loans.find(l => l.id === payment.loan_id || l.loan_number === payment.loan_id) || payment.loan;
    const loanPayments = payments.filter(p => p.loan_id === payment.loan_id || (targetLoan && (p.loan_id === targetLoan.id || p.loan_id === targetLoan.loan_number)));
    const enrichedLoan = targetLoan ? { ...targetLoan, payments: loanPayments } : undefined;
    printSinglePaymentReceiptPDF({ ...payment, loan: enrichedLoan }, session?.shop || null, language);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-600" />
              <span>{dict.repayment.title}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {dict.repayment.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4 text-rose-600" />
              <span>{dict.reports.printReport}</span>
            </button>

            <button
              onClick={handleExport}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{dict.reports.exportExcel}</span>
            </button>
          </div>
        </div>

        {/* 1. Loan Summary & Payments Overview Cards (Requirement #3) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'एकूण मंजूर कर्ज' : 'Original Disbursed Amount'}</span>
              <Coins className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-extrabold text-slate-900">
              {formatCurrency(summaryMetrics.totalDisbursed)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">
              {isMarathi ? 'एकत्रित कर्ज खाते' : 'Across all loan accounts'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'एकूण जमा रक्कम' : 'Total Amount Paid'}</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl font-extrabold text-emerald-700">
              {formatCurrency(summaryMetrics.totalPaid)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">
              {isMarathi ? 'एकूण जमा व्यवहार' : `${summaryMetrics.totalReceipts} valid payments recorded`}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-amber-700 text-xs font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'उर्वरित येणेबाकी मुद्दल' : 'Remaining Outstanding'}</span>
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-xl font-extrabold text-amber-800">
              {formatCurrency(summaryMetrics.totalOutstanding)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">
              {isMarathi ? 'शिल्लक मुद्दल येणे' : 'Net principal balance due'}
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'एकूण जारी पावत्या' : 'Total Transactions'}</span>
              <Receipt className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-xl font-extrabold text-blue-700">
              {summaryMetrics.totalReceipts} {isMarathi ? 'पावत्या' : 'Receipts'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-medium">
              {isMarathi ? 'कायमस्वरूपी नोंदवलेले व्यवहार' : 'Permanently saved in database'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isMarathi ? 'पावती #, भरणा प्रकार, किंवा पद्धत शोधा...' : 'Search by receipt #, payment type, or method...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{dict.repayment.receiptNumber}</th>
                  <th className="py-3 px-4">{dict.common.date}</th>
                  <th className="py-3 px-4">{dict.loan.contractNumber}</th>
                  <th className="py-3 px-4">{dict.repayment.repaymentPurpose}</th>
                  <th className="py-3 px-4">{dict.repayment.paymentMethod}</th>
                  <th className="py-3 px-4">{dict.repayment.receiptNotes}</th>
                  <th className="py-3 px-4">{dict.common.total}</th>
                  <th className="py-3 px-4 text-right">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {dict.common.loading}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {dict.common.noRecords}
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                        {p.receipt_number}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        {p.loan?.loan_number || '-'}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.payment_type}</td>
                      <td className="py-3.5 px-4">{p.payment_method}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{p.notes || '-'}</td>
                      <td className="py-3.5 px-4 font-black text-emerald-700 text-sm">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handlePrintReceipt(p)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-600 hover:text-white rounded-lg text-[11px] font-bold text-slate-700 transition-colors inline-flex items-center gap-1"
                        >
                          <Printer className="w-3 h-3" />
                          <span>{dict.common.print}</span>
                        </button>
                      </td>
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
