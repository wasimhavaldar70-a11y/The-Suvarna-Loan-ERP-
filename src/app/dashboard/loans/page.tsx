'use client';

// ========================================================
// SuvarnaLoan ERP - Active Loans Management & Loan Creation
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/loans/page.tsx
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Printer, Coins, Plus, Search, Filter, FileSpreadsheet, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import DashboardLayout from '../../../components/DashboardLayout';
import { CreateGoldLoanModal } from '../../../components/CreateGoldLoanModal';
import { db, setupRealtimeSync, clearDbCache } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Loan } from '../../../types';
import { formatCurrency, formatWeight, formatDate } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';
import { exportToPDF } from '../../../lib/pdf-export';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function LoansPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [createLoanModalOpen, setCreateLoanModalOpen] = useState(false);

  const loadLoans = (isInitial = false) => {
    if (isInitial && loans.length === 0) {
      setLoading(true);
    }
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
    loadLoans(true);

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'loans' || e.detail.table === 'payments' || e.detail.table === 'customers') {
        loadLoans(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', () => loadLoans(false));
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', () => loadLoans(false));
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return loans.filter((l) => {
      const cust = l.customer?.full_name || '';
      const mobile = l.customer?.mobile_number || '';
      const num = l.loan_number || '';
      const matchesSearch = cust.toLowerCase().includes(query) || mobile.toLowerCase().includes(query) || num.toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'ALL'
          ? l.status !== 'Closed'
          : statusFilter === 'ALL_RECORDS'
          ? true
          : l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [loans, search, statusFilter]);

  const handleExport = () => {
    const loansToExport = filtered.length > 0
      ? filtered
      : loans.filter(l => l.status === 'Active' || l.status === 'Overdue' || l.status !== 'Closed');

    if (!loansToExport.length) {
      toast.error(isMarathi ? 'डाउनलोड करण्यासाठी कोणतीही सक्रिय कर्ज खाती उपलब्ध नाहीत.' : 'No active or overdue loan records available to export.');
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

    exportToExcel(rows, `Gold_Loans_Register_${new Date().toISOString().split('T')[0]}`, 'Loans', columnMap);
    toast.success(isMarathi ? 'कर्ज नोंदवही एक्सेलमध्ये यशस्वीरित्या डाउनलोड झाली!' : `Exported ${rows.length} active & overdue loan contracts to Excel!`);
  };

  const handlePrint = () => {
    const session = getSessionUser();
    const headers = [
      dict.loan.contractNumber,
      dict.loan.borrowerName,
      dict.goldItem.ornamentType,
      dict.goldItem.netWeight,
      dict.loan.loanAmount,
      dict.loan.interestRate,
      dict.common.status,
    ];
    const data = filtered.map((l) => [
      l.loan_number,
      l.customer?.full_name || 'N/A',
      l.gold_item?.ornament_type || 'N/A',
      formatWeight(l.gold_item?.net_weight),
      formatCurrency(l.loan_amount),
      `${l.interest_rate}%`,
      l.status,
    ]);
    exportToPDF({
      title: isMarathi ? 'सुवर्ण कर्ज खाते नोंदवही' : 'SuvarnaLoan Portfolio Register',
      subtitle: isMarathi ? 'सक्रिय व थकीत सुवर्ण कर्ज खाती' : 'Active and Overdue Gold Loan Accounts',
      columns: headers,
      rows: data,
      shop: session?.shop,
      filename: `Gold_Loans_${new Date().toISOString().split('T')[0]}`,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Header and Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Coins className="w-6 h-6 text-amber-600" />
              <span>{dict.loan.title}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {dict.loan.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setCreateLoanModalOpen(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-700 hover:to-amber-600 text-white rounded-xl font-bold text-xs shadow-md gold-glow transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{dict.dashboard.issueLoanBtn}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{dict.reports.exportExcel}</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold shadow-2xs transition-colors"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>{dict.reports.printReport}</span>
            </button>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={isMarathi ? 'ग्राहक नाव, फोन किंवा कर्ज क्रमांक...' : 'Search customer name, phone, or loan #...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto items-center">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-auto px-3 py-1.5 text-xs border border-slate-200 rounded-xl bg-slate-50 font-semibold text-slate-700 focus:outline-none"
            >
              <option value="ALL">{isMarathi ? 'सर्व सक्रिय व थकीत खाती' : 'All Active & Overdue'}</option>
              <option value="ALL_RECORDS">{isMarathi ? 'सर्व खाती (सक्रिय, थकीत व बंद)' : 'All Loan Contracts (Active, Overdue & Closed)'}</option>
              <option value="Active">{isMarathi ? 'फक्त सक्रिय' : 'Active Only'}</option>
              <option value="Overdue">{isMarathi ? 'फक्त थकीत (NPA)' : 'Overdue Only (NPA)'}</option>
              <option value="Closed">{isMarathi ? 'पूर्ण परतफेड झालेली बंद खाती' : 'Closed / Settled Loans'}</option>
            </select>
          </div>
        </div>

        {/* Loan Contracts Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
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
                  <th className="py-3 px-4">{dict.loan.disbursementDate}</th>
                  <th className="py-3 px-4">{dict.common.status}</th>
                  <th className="py-3 px-4 text-right">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                      {dict.common.loading}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                      {dict.common.noRecords}
                    </td>
                  </tr>
                ) : (
                  filtered.map((l) => {
                    const custName = l.customer?.full_name || 'Valued Customer';
                    const mobile = l.customer?.mobile_number || 'N/A';
                    return (
                      <tr key={l.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="py-3.5 px-4 font-extrabold text-amber-700">
                          <Link href={`/dashboard/loans/${l.id}`} className="hover:underline flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5" />
                            <span>{l.loan_number}</span>
                          </Link>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{custName}</div>
                          <div className="text-[10px] text-slate-400">{mobile}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800">{l.gold_item?.ornament_type || 'Gold Item'}</span>
                          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold">
                            {l.gold_item?.purity || '22K'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {formatWeight(l.gold_item?.net_weight)}
                        </td>
                        <td className="py-3.5 px-4 font-extrabold text-slate-900">
                          {formatCurrency(l.loan_amount)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700">
                          {l.interest_rate}% / mo
                        </td>
                        <td className="py-3.5 px-4 text-slate-500">
                          {formatDate(l.loan_date)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              l.status === 'Active'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : l.status === 'Overdue'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {l.status === 'Active' ? dict.common.active : l.status === 'Overdue' ? dict.common.overdue : dict.common.closed}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link
                            href={`/dashboard/loans/${l.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-amber-500 hover:text-white rounded-lg text-[11px] font-bold text-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{dict.loan.viewDetails}</span>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal for creating a new loan */}
        <CreateGoldLoanModal
          isOpen={createLoanModalOpen}
          onClose={() => setCreateLoanModalOpen(false)}
          onSuccess={() => loadLoans(true)}
        />
      </div>
    </DashboardLayout>
  );
}
