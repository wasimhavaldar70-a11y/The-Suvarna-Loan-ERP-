'use client';

// ========================================================
// SuvarnaLoan ERP - Payments & Receipts Ledger
// Location: src/app/dashboard/payments/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Receipt, Search, FileSpreadsheet, Printer } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Payment } from '../../../types';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';

export default function PaymentsPage() {
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
    exportToExcel(rows, `Payments_Ledger_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Payments & GST Receipts History Ledger
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Counter collections, interest payments, part repayments & tax receipts
            </p>
          </div>

          <button
            onClick={handleExport}
            className="px-4 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 self-start md:self-auto transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Payments Excel</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search receipt #, payment method, or notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Loan Contract</th>
                  <th className="py-3 px-4">Repayment Type</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Loading payments...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No payment transactions recorded.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-amber-700">{p.receipt_number}</td>
                      <td className="py-3.5 px-4 text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.loan?.loan_number || 'GL-2026-001'}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{p.payment_type}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-bold text-[10px] text-slate-700">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-600">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">{p.notes || '-'}</td>
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
