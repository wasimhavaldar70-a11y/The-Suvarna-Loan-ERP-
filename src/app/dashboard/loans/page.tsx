'use client';

// ========================================================
// SuvarnaLoan ERP - Active Loans Management & Loan Creation
// Location: src/app/dashboard/loans/page.tsx
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Coins, Plus, Search, Filter, FileSpreadsheet, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../../../components/DashboardLayout';
import { CreateGoldLoanModal } from '../../../components/CreateGoldLoanModal';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Loan } from '../../../types';
import { formatCurrency, formatWeight, formatDate } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [createLoanModalOpen, setCreateLoanModalOpen] = useState(false);

  const loadLoans = () => {
    setLoading(true);
    const session = getSessionUser();
    const shopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!shopId) {
      setLoading(false);
      return;
    }
    db.getLoans(shopId).then((data) => {
      setLoans(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadLoans();
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return loans.filter((l) => {
      const cust = l.customer?.full_name || '';
      const mobile = l.customer?.mobile_number || '';
      const num = l.loan_number || '';
      const matchesSearch = cust.toLowerCase().includes(query) || mobile.toLowerCase().includes(query) || num.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' ? l.status !== 'Closed' : l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loans, search, statusFilter]);

  const handleExport = () => {
    const loansToExport = filtered.length > 0
      ? filtered
      : loans.filter(l => l.status === 'Active' || l.status === 'Overdue' || l.status !== 'Closed');

    if (!loansToExport.length) {
      toast.error('No active or overdue loan records available to export.');
      return;
    }

    const rows = loansToExport.map((l) => ({
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
    exportToExcel(rows, `Gold_Loans_Register_${new Date().toISOString().split('T')[0]}`);
    toast.success(`Exported ${rows.length} active & overdue loan contracts to Excel!`);
  };

  const handleDeleteLoan = async (loan: Loan) => {
    if (confirm(`Are you sure you want to delete Loan ${loan.loan_number}? This will permanently remove the record.`)) {
      await db.deleteLoan(loan.id, loan.shop_id);
      toast.success(`Loan ${loan.loan_number} deleted successfully`);
      loadLoans();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Active Gold Loans Directory
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage pledged gold loan portfolio, track maturity dates & interest payments
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={() => setCreateLoanModalOpen(true)}
              className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl shadow-md gold-glow hover:brightness-105 flex items-center gap-1.5 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Disburse New Gold Loan</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by loan # or customer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold focus:outline-none"
              >
                <option value="ALL">All Active & Overdue</option>
                <option value="Active">Active Only</option>
                <option value="Overdue">Overdue Only</option>
                <option value="Closed">Closed Loans Archive</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Loan Number</th>
                  <th className="py-3 px-4">Borrower</th>
                  <th className="py-3 px-4">Pledged Ornament</th>
                  <th className="py-3 px-4">Net Gold Weight</th>
                  <th className="py-3 px-4">Loan Amount</th>
                  <th className="py-3 px-4">Rate / Mo</th>
                  <th className="py-3 px-4">Loan Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      Loading gold loans...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">
                      No loan records found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((loan, idx) => (
                    <tr key={`${loan.id}-${loan.loan_number}-${idx}`} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-amber-700">{loan.loan_number}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{loan.customer?.full_name}</div>
                        <div className="text-[10px] text-slate-400">{loan.customer?.mobile_number}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">
                        <span className="mr-1.5 inline-block text-[11px]">
                          {loan.gold_item?.metal_type === 'Silver' ? '⚪' : '🟡'}
                        </span>
                        <span>{loan.gold_item?.ornament_type} ({loan.gold_item?.purity})</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {formatWeight(loan.gold_item?.net_weight)}
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">
                        {formatCurrency(loan.loan_amount)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{loan.interest_rate}%</td>
                      <td className="py-3.5 px-4 text-slate-500">{formatDate(loan.loan_date)}</td>
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
                          {loan.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/dashboard/loans/${loan.id}`}
                            className="px-3 py-1 text-[11px] font-bold bg-amber-500 text-white rounded-lg hover:bg-amber-600 inline-flex items-center gap-1 shadow-2xs"
                          >
                            <Eye className="w-3.5 h-3.5" /> View
                          </Link>
                          <button
                            onClick={() => handleDeleteLoan(loan)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete Loan Record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Disburse Gold Loan Modal */}
      <CreateGoldLoanModal
        isOpen={createLoanModalOpen}
        onClose={() => setCreateLoanModalOpen(false)}
        onSuccess={loadLoans}
      />
    </DashboardLayout>
  );
}
