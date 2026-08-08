'use client';

// ========================================================
// SuvarnaLoan ERP - Payments & Receipts Ledger
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/payments/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Receipt, Search, FileSpreadsheet, Printer, Download } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Payment } from '../../../types';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';
import { printSinglePaymentReceiptPDF } from '../../../lib/closureDocumentGenerator';
import { exportToPDF } from '../../../lib/pdf-export';
import { toast } from 'sonner';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function PaymentsPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadPayments = () => {
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) {
      setLoading(false);
      return;
    }
    db.getPayments(activeShopId).then((data) => {
      setPayments(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadPayments();

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'payments' || e.detail.table === 'loans') {
        loadPayments();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', loadPayments);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', loadPayments);
      }
    };
  }, []);

  const filtered = React.useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return payments;
    return payments.filter(
      (p) =>
        (p.receipt_number && p.receipt_number.toLowerCase().includes(query)) ||
        (p.payment_type && p.payment_type.toLowerCase().includes(query)) ||
        (p.payment_method && p.payment_method.toLowerCase().includes(query)) ||
        (p.notes && p.notes.toLowerCase().includes(query))
    );
  }, [payments, search]);

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
    printSinglePaymentReceiptPDF(payment, session?.shop || null, language);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
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
