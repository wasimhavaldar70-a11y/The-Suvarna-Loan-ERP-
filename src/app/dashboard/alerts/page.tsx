'use client';

// ========================================================
// SuvarnaLoan ERP - Customer Alerts & WhatsApp Notification Hub
// Location: src/app/dashboard/alerts/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  MessageSquare,
  Send,
  Printer,
  Download,
  Copy,
  Search,
  Filter,
  Users,
  Phone,
  Coins,
  FileCheck,
  Receipt,
  Calendar,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  Clock,
  FileText
} from 'lucide-react';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { Loan, Shop } from '../../../types';
import { formatCurrency, formatDate, formatWeight } from '../../../lib/utils';
import { calculateLoanFinancials } from '../../../lib/goldValuationEngine';
import {
  AlertType,
  generateWhatsAppMessageText,
  sendWhatsAppAlert,
  formatWhatsAppPhone
} from '../../../lib/whatsappNotificationHelper';
import {
  generateNoDueCertificateHTML,
  generateClosureCertificateHTML,
  generateRepaymentReceiptHTML,
  printHTMLDocument,
  downloadHTMLDocument
} from '../../../lib/closureDocumentGenerator';
import { toast } from 'sonner';

export default function CustomerAlertsPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [currentShop, setCurrentShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DUE' | 'OVERDUE' | 'CLOSED'>('ALL');

  // Selected Loan & Alert State
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [selectedType, setSelectedType] = useState<AlertType>('MONTHLY_DUE');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [messageText, setMessageText] = useState<string>('');

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
    const [shop, data] = await Promise.all([
      db.getShop(activeShopId),
      db.getLoans(activeShopId)
    ]);
    if (shop) setCurrentShop(shop);
    setLoans(data);
    if (data.length > 0) {
      setSelectedLoan(data[0]);
      setCustomPhone(data[0].customer?.mobile_number || '');
      const text = generateWhatsAppMessageText('MONTHLY_DUE', {
        loan: data[0],
        shopName: shop?.shop_name || 'Suvarna Gold Jewellers'
      });
      setMessageText(text);
    }
    setLoading(false);
  };

  const handleSelectLoan = (loan: Loan) => {
    setSelectedLoan(loan);
    setCustomPhone(loan.customer?.mobile_number || '');
    
    // Choose default template depending on loan status
    let defaultTpl: AlertType = 'MONTHLY_DUE';
    if (loan.status === 'Overdue') defaultTpl = 'OVERDUE_ALERT';
    else if (loan.status === 'Closed') defaultTpl = 'LOAN_CLOSURE';

    setSelectedType(defaultTpl);
    const text = generateWhatsAppMessageText(defaultTpl, {
      loan,
      shopName: currentShop?.shop_name
    });
    setMessageText(text);
  };

  const handleTemplateChange = (type: AlertType) => {
    setSelectedType(type);
    if (!selectedLoan) return;
    const text = generateWhatsAppMessageText(type, {
      loan: selectedLoan,
      shopName: currentShop?.shop_name
    });
    setMessageText(text);
  };

  const handleSendWhatsApp = () => {
    if (!selectedLoan) return;
    const targetPhone = customPhone || selectedLoan.customer?.mobile_number;
    sendWhatsAppAlert(targetPhone, messageText);
    toast.success(`Launched WhatsApp alert for ${selectedLoan.customer?.full_name || 'Customer'}`);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    toast.success('WhatsApp alert text copied to clipboard!');
  };

  // PDF Printing and Downloading actions
  const handlePrintRepaymentReceipt = () => {
    if (!selectedLoan) return;
    const html = generateRepaymentReceiptHTML({ loan: selectedLoan, shop: currentShop });
    printHTMLDocument(html);
    toast.success('Sent Repayment Receipt to browser print manager');
  };

  const handleDownloadRepaymentReceipt = () => {
    if (!selectedLoan) return;
    const html = generateRepaymentReceiptHTML({ loan: selectedLoan, shop: currentShop });
    downloadHTMLDocument(html, `Repayment_Receipt_${selectedLoan.loan_number}.html`);
    toast.success('Downloaded Repayment Receipt file');
  };

  const handlePrintClosureCertificate = () => {
    if (!selectedLoan) return;
    const html = generateClosureCertificateHTML({ loan: selectedLoan, shop: currentShop });
    printHTMLDocument(html);
    toast.success('Sent Loan Closure Certificate to browser print manager');
  };

  const handlePrintNoDueCertificate = () => {
    if (!selectedLoan) return;
    const html = generateNoDueCertificateHTML({ loan: selectedLoan, shop: currentShop });
    printHTMLDocument(html);
    toast.success('Sent No Due Certificate to browser print manager');
  };

  // Filtering loans
  const filteredLoans = loans.filter((loan) => {
    const custName = loan.customer?.full_name?.toLowerCase() || '';
    const custMobile = loan.customer?.mobile_number || '';
    const loanNo = loan.loan_number.toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = custName.includes(q) || custMobile.includes(q) || loanNo.includes(q);

    if (!matchesSearch) return false;

    const fin = calculateLoanFinancials(
      loan.loan_amount,
      loan.interest_rate,
      loan.loan_date,
      loan.due_date,
      loan.payments
    );

    if (statusFilter === 'DUE') return loan.status === 'Active' && fin.netAccruedInterest > 0;
    if (statusFilter === 'OVERDUE') return loan.status === 'Overdue' || fin.overdueDays > 0;
    if (statusFilter === 'CLOSED') return loan.status === 'Closed';

    return true;
  });

  // Calculate high-level KPIs
  const totalAccruedInterestAll = loans.reduce((acc, l) => {
    const f = calculateLoanFinancials(l.loan_amount, l.interest_rate, l.loan_date, l.due_date, l.payments);
    return acc + f.netAccruedInterest;
  }, 0);

  const overdueCount = loans.filter((l) => {
    const f = calculateLoanFinancials(l.loan_amount, l.interest_rate, l.loan_date, l.due_date, l.payments);
    return l.status === 'Overdue' || f.overdueDays > 0;
  }).length;

  const closedCount = loans.filter((l) => l.status === 'Closed').length;

  const templatesList: { type: AlertType; label: string; icon: any; badgeColor: string }[] = [
    { type: 'MONTHLY_DUE', label: 'Monthly Due & Interest', icon: Calendar, badgeColor: 'text-amber-700 bg-amber-50 border-amber-200' },
    { type: 'REPAYMENT_RECEIPT', label: 'Payment Receipt', icon: Receipt, badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { type: 'LOAN_CLOSURE', label: 'Loan Closure Cert.', icon: FileCheck, badgeColor: 'text-sky-700 bg-sky-50 border-sky-200' },
    { type: 'OVERDUE_ALERT', label: 'Urgent Overdue Alert', icon: AlertTriangle, badgeColor: 'text-rose-700 bg-rose-50 border-rose-200' },
    { type: 'GOLD_RELEASE', label: 'Pledged Gold Release', icon: Lock, badgeColor: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    { type: 'CUSTOM', label: 'Custom Alert Message', icon: MessageSquare, badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-gradient-to-tr from-emerald-600 to-emerald-400 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Customer Alerts & WhatsApp Hub</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Send repayment PDFs, WhatsApp dues reminders, EMI notices & loan clear certificates directly to customers
              </p>
            </div>
          </div>

          <button
            onClick={loadData}
            className="self-start sm:self-center px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Dues</span>
          </button>
        </div>

        {/* KPI Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Customer Accounts</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{loans.length}</div>
              <span className="text-[11px] font-semibold text-slate-500">Registered Gold Loans</span>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-amber-600 tracking-wider">Accrued Interest Dues</span>
              <div className="text-2xl font-black text-amber-700 mt-1">{formatCurrency(totalAccruedInterestAll)}</div>
              <span className="text-[11px] font-semibold text-amber-600">Pending Collection</span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200/60">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-rose-600 tracking-wider">Overdue Alerts</span>
              <div className="text-2xl font-black text-rose-700 mt-1">{overdueCount}</div>
              <span className="text-[11px] font-semibold text-rose-600">Action Required</span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200/60">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-emerald-600 tracking-wider">Closed & Settled</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{closedCount}</div>
              <span className="text-[11px] font-semibold text-emerald-600">Clear Certificates</span>
            </div>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200/60">
              <FileCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Main Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Loan Selector List (5 Columns) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search & Filter Options */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer, mobile # or loan #..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold overflow-x-auto">
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  All ({loans.length})
                </button>
                <button
                  onClick={() => setStatusFilter('DUE')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'DUE' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-amber-700'
                  }`}
                >
                  Dues
                </button>
                <button
                  onClick={() => setStatusFilter('OVERDUE')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'OVERDUE' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-rose-700'
                  }`}
                >
                  Overdue
                </button>
                <button
                  onClick={() => setStatusFilter('CLOSED')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'CLOSED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  Closed
                </button>
              </div>
            </div>

            {/* Customer Loans List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden max-h-[700px] overflow-y-auto divide-y divide-slate-100">
              {filteredLoans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No customer loan records found matching filter criteria.
                </div>
              ) : (
                filteredLoans.map((loan, idx) => {
                  const fin = calculateLoanFinancials(
                    loan.loan_amount,
                    loan.interest_rate,
                    loan.loan_date,
                    loan.due_date,
                    loan.payments
                  );
                  const isSelected = selectedLoan?.id === loan.id;
                  const isOverdue = loan.status === 'Overdue' || fin.overdueDays > 0;
                  const isClosed = loan.status === 'Closed';

                  return (
                    <div
                      key={`${loan.id}-${loan.loan_number}-${idx}`}
                      onClick={() => handleSelectLoan(loan)}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-emerald-50/70 border-l-4 border-l-emerald-600'
                          : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-900 truncate">
                            {loan.customer?.full_name || 'Customer'}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-slate-400">({loan.loan_number})</span>
                        </div>

                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            isClosed
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOverdue
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isClosed ? 'Closed' : isOverdue ? `Overdue (${fin.overdueDays}d)` : 'Active'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="text-slate-500 text-[11px] font-medium">
                          Pledged: <span className="font-semibold text-slate-800">{loan.gold_item?.ornament_type || 'Gold Item'}</span> ({formatWeight(loan.gold_item?.net_weight || 0)})
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Accrued Due</span>
                          <span className="font-black text-amber-700">{formatCurrency(fin.netAccruedInterest)}</span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {loan.customer?.mobile_number || 'No mobile'}
                        </span>
                        <span className="font-bold text-slate-700">
                          Total Due: {formatCurrency(fin.totalBalanceDue)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Customer Alert & Document Dispatch Workspace (7 Columns) */}
          <div className="lg:col-span-7 space-y-6">
            {!selectedLoan ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs">
                <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-700">No Customer Selected</h3>
                <p className="text-xs text-slate-400 mt-1">Select a customer loan account from the left list to generate alerts & receipts.</p>
              </div>
            ) : (
              (() => {
                const fin = calculateLoanFinancials(
                  selectedLoan.loan_amount,
                  selectedLoan.interest_rate,
                  selectedLoan.loan_date,
                  selectedLoan.due_date,
                  selectedLoan.payments
                );
                const isClosed = selectedLoan.status === 'Closed';
                const isOverdue = selectedLoan.status === 'Overdue' || fin.overdueDays > 0;

                return (
                  <div className="space-y-6">
                    {/* Active Customer Header Card */}
                    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white p-6 rounded-3xl shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-700/80">
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                              {selectedLoan.customer?.full_name || 'Customer'}
                            </h2>
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                              {selectedLoan.loan_number}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                            <span>Sanction: <strong className="text-white">{formatCurrency(selectedLoan.loan_amount)}</strong></span>
                            <span>Rate: <strong className="text-amber-300">{selectedLoan.interest_rate}%/mo</strong></span>
                            <span>Date: <strong className="text-white">{formatDate(selectedLoan.loan_date)}</strong></span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">Mobile #:</span>
                          <input
                            type="text"
                            value={customPhone}
                            onChange={(e) => setCustomPhone(e.target.value)}
                            placeholder="+91 Mobile #"
                            className="px-3 py-1.5 text-xs font-mono font-bold border border-slate-700 rounded-xl bg-slate-800 text-white focus:outline-none focus:border-emerald-500 w-36"
                          />
                        </div>
                      </div>

                      {/* Financial Breakdown Pills */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-amber-400 block">Accrued Interest Due</span>
                          <span className="text-base font-black text-amber-300">{formatCurrency(fin.netAccruedInterest)}</span>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block">Total Outstanding</span>
                          <span className="text-base font-black text-white">{formatCurrency(fin.totalBalanceDue)}</span>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-sky-400 block">Monthly Rate EMI</span>
                          <span className="text-base font-black text-sky-300">{formatCurrency(fin.emiAmount)}</span>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-purple-400 block">Pledged Asset</span>
                          <span className="text-xs font-bold text-slate-200 truncate block mt-1">
                            {selectedLoan.gold_item?.ornament_type || 'Gold Item'} ({formatWeight(selectedLoan.gold_item?.net_weight || 0)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PDF & Certificate Generation Action Bar */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span>Generate & Print Customer PDF Documents</span>
                        </h3>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          A4 Print Format
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">Repayment Receipt PDF</span>
                            <span className="text-[10px] text-slate-500">Official receipt with payment breakdown</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handlePrintRepaymentReceipt}
                              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-colors"
                              title="Print Repayment Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleDownloadRepaymentReceipt}
                              className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
                              title="Download Receipt File"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">Loan Closure Certificate</span>
                            <span className="text-[10px] text-slate-500">Gold asset release & closure document</span>
                          </div>
                          <button
                            onClick={handlePrintClosureCertificate}
                            className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-xs transition-colors"
                            title="Print Closure Certificate"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between sm:col-span-2">
                          <div>
                            <span className="font-bold text-slate-800 block">No Due Certificate (NDC) PDF</span>
                            <span className="text-[10px] text-slate-500">Official clear certificate verifying zero remaining dues</span>
                          </div>
                          <button
                            onClick={handlePrintNoDueCertificate}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Print NDC</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Alert Generator & Dispatch Panel */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-md shadow-emerald-500/20">
                          <MessageSquare className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900">
                            WhatsApp Customer Alert Generator
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            Select a pre-formatted message template or write a custom alert text to send directly via WhatsApp
                          </p>
                        </div>
                      </div>

                      {/* Template Selector Grid */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          Select Message Alert Template:
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          {templatesList.map((tpl) => {
                            const Icon = tpl.icon;
                            const active = selectedType === tpl.type;
                            return (
                              <button
                                key={tpl.type}
                                type="button"
                                onClick={() => handleTemplateChange(tpl.type)}
                                className={`p-2.5 rounded-xl font-bold border text-left flex items-center gap-2 transition-all ${
                                  active
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-2xs ring-2 ring-emerald-500/20'
                                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                                <span className="truncate">{tpl.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Text Editor Box */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            <span>WhatsApp Message Body (Live Preview / Editable):</span>
                          </span>
                          <span className="text-slate-400 text-[10px]">Formatted for WhatsApp</span>
                        </div>

                        <textarea
                          rows={9}
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          className="w-full p-4 text-xs font-mono bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl focus:outline-none focus:border-emerald-500 leading-relaxed shadow-inner"
                        />
                      </div>

                      {/* Footer Dispatch Actions */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={handleCopyText}
                          className="px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                          <span>Copy Message Text</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          className="px-6 py-2.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                          <span>Send WhatsApp Alert Now</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
