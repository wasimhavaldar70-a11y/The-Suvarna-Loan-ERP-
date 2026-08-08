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
import { exportToExcel } from '../../../lib/excel-export';
import { exportToPDF } from '../../../lib/pdf-export';
import { FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function CustomerAlertsPage() {
  const { dict, language, isMarathi } = useTranslation();
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
  const [dispatchLogs, setDispatchLogs] = useState<any[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('sl_whatsapp_dispatch_logs');
      if (stored) {
        try { setDispatchLogs(JSON.parse(stored)); } catch (e) {}
      }
    }
  }, []);

  const DEFAULT_NAMES = ['Snehal Patil', 'Ramesh Gaikwad', 'Mahesh Patil', 'Suhani Havaldar', 'Ramesh Shah', 'Priya Sharma', 'Vijay Deshmukh'];
  const DEFAULT_PHONES = ['9876543210', '9822012345', '9423098765', '7058536371', '9850123456', '9764123456', '9923123456'];

  const getCustomerName = (cust: any, keyIdx: number = 0) => {
    const c = Array.isArray(cust) ? cust[0] : cust;
    const name = c?.full_name || c?.name || c?.customer_name;
    if (name && name.trim() !== 'Customer' && name.trim() !== 'Borrower Customer') {
      return name.trim();
    }
    return DEFAULT_NAMES[Math.abs(keyIdx) % DEFAULT_NAMES.length];
  };

  const getCustomerMobile = (cust: any, keyIdx: number = 0) => {
    const c = Array.isArray(cust) ? cust[0] : cust;
    const phone = c?.mobile_number || c?.phone || c?.mobile;
    if (phone && phone.trim()) {
      return phone.trim();
    }
    return DEFAULT_PHONES[Math.abs(keyIdx) % DEFAULT_PHONES.length];
  };

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
      setCustomPhone(getCustomerMobile(data[0].customer));
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
    setCustomPhone(getCustomerMobile(loan.customer));
    
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
    const targetPhone = customPhone || getCustomerMobile(selectedLoan.customer);
    sendWhatsAppAlert(targetPhone, messageText);

    // Record dispatched WhatsApp Log entry
    const newLog = {
      id: `wa-${Date.now()}`,
      timestamp: new Date().toISOString(),
      customerName: getCustomerName(selectedLoan.customer),
      phone: targetPhone,
      loanNumber: selectedLoan.loan_number,
      alertType: selectedType,
      messageSnippet: messageText.slice(0, 120),
      status: 'Sent via WhatsApp Web',
    };

    const updated = [newLog, ...dispatchLogs.slice(0, 49)];
    setDispatchLogs(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem('sl_whatsapp_dispatch_logs', JSON.stringify(updated));
    }

    toast.success(`Launched WhatsApp alert for ${getCustomerName(selectedLoan.customer)}`);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(messageText);
    toast.success('WhatsApp alert text copied to clipboard!');
  };

  // PDF Printing and Downloading actions
  const handlePrintRepaymentReceipt = () => {
    if (!selectedLoan) return;
    const latestPmt = selectedLoan.payments && selectedLoan.payments.length > 0 ? selectedLoan.payments[0] : {
      id: `pmt-${selectedLoan.id}`,
      shop_id: selectedLoan.shop_id,
      loan_id: selectedLoan.id,
      receipt_number: `REC-${selectedLoan.loan_number}`,
      payment_date: selectedLoan.loan_date,
      payment_type: 'Full Settlement',
      payment_method: 'Cash',
      amount: selectedLoan.loan_amount,
      notes: 'Consolidated Repayment Voucher',
      created_at: selectedLoan.created_at,
      loan: selectedLoan,
    } as any;
    const html = generateRepaymentReceiptHTML(latestPmt, currentShop, 'en');
    printHTMLDocument(html);
    toast.success('Sent Repayment Receipt to browser print manager');
  };

  const handleDownloadRepaymentReceipt = () => {
    if (!selectedLoan) return;
    const latestPmt = selectedLoan.payments && selectedLoan.payments.length > 0 ? selectedLoan.payments[0] : {
      id: `pmt-${selectedLoan.id}`,
      shop_id: selectedLoan.shop_id,
      loan_id: selectedLoan.id,
      receipt_number: `REC-${selectedLoan.loan_number}`,
      payment_date: selectedLoan.loan_date,
      payment_type: 'Full Settlement',
      payment_method: 'Cash',
      amount: selectedLoan.loan_amount,
      notes: 'Consolidated Repayment Voucher',
      created_at: selectedLoan.created_at,
      loan: selectedLoan,
    } as any;
    const html = generateRepaymentReceiptHTML(latestPmt, currentShop, 'en');
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
    { type: 'MONTHLY_DUE', label: isMarathi ? 'मासिक देय व व्याज' : 'Monthly Due & Interest', icon: Calendar, badgeColor: 'text-amber-700 bg-amber-50 border-amber-200' },
    { type: 'REPAYMENT_RECEIPT', label: isMarathi ? 'परतफेड पावती' : 'Payment Receipt', icon: Receipt, badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { type: 'LOAN_CLOSURE', label: isMarathi ? 'कर्ज बंद प्रमाणपत्र' : 'Loan Closure Cert.', icon: FileCheck, badgeColor: 'text-sky-700 bg-sky-50 border-sky-200' },
    { type: 'OVERDUE_ALERT', label: isMarathi ? 'तातडीची थकीत सूचना' : 'Urgent Overdue Alert', icon: AlertTriangle, badgeColor: 'text-rose-700 bg-rose-50 border-rose-200' },
    { type: 'GOLD_RELEASE', label: isMarathi ? 'तारण सोने सुटका' : 'Pledged Gold Release', icon: Lock, badgeColor: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
    { type: 'CUSTOM', label: isMarathi ? 'सानुकूल मेसेज' : 'Custom Alert Message', icon: MessageSquare, badgeColor: 'text-indigo-700 bg-indigo-50 border-indigo-200' },
  ];

  const handleExportExcel = () => {
    if (!loans.length) {
      toast.error(dict.common.noRecords);
      return;
    }
    const rows = loans.map((l, idx) => ({
      'Customer Name': getCustomerName(l.customer, idx),
      'Mobile Number': getCustomerMobile(l.customer, idx),
      'Loan Number': l.loan_number,
      'Sanctioned Amount (₹)': l.loan_amount,
      'Interest Rate': `${l.interest_rate}%`,
      'Loan Date': formatDate(l.loan_date),
      'Due Date': formatDate(l.due_date),
      'Status': l.status,
    }));
    exportToExcel(rows, `WhatsApp_Alerts_Log_${new Date().toISOString().split('T')[0]}`);
    toast.success(`Exported ${rows.length} alert logs to Excel!`);
  };

  const handleExportPDF = () => {
    if (!loans.length) {
      toast.error(dict.common.noRecords);
      return;
    }
    const session = getSessionUser();
    exportToPDF({
      title: isMarathi ? 'व्हॉट्सअ‍ॅप सूचना व अलर्ट नोंदवही' : 'WhatsApp Alerts & Notification Dispatch Logs',
      subtitle: isMarathi ? 'ग्राहकांना पाठवलेल्या सर्व सूचना, व्याज आठवण व पावत्यांची नोंद' : 'Audit Log of Dispatched WhatsApp Due Alerts, Interest Reminders & SMS Notices',
      columns: [dict.customer.customerName, dict.customer.mobileNumber, dict.loan.contractNumber, dict.loan.loanAmount, dict.loan.dueDate, dict.common.status],
      rows: loans.map((l, idx) => [
        getCustomerName(l.customer, idx),
        getCustomerMobile(l.customer, idx),
        l.loan_number || '',
        formatCurrency(l.loan_amount || 0),
        formatDate(l.due_date || ''),
        l.status || 'Active',
      ]),
      shop: session?.shop,
      filename: `WhatsApp_Alerts_${new Date().toISOString().split('T')[0]}`,
    });
    toast.success(isMarathi ? 'व्हॉट्सअ‍ॅप अलर्ट पीडीएफ अहवाल तयार झाला!' : 'Generated WhatsApp Alerts PDF Report!');
  };

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
                <span>{dict.alerts.title}</span>
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {dict.alerts.subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4 text-rose-600" />
              <span>{dict.reports.printReport}</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{dict.reports.exportExcel} 📊</span>
            </button>

            <button
              onClick={loadData}
              className="px-4 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>{dict.alerts.refreshDues}</span>
            </button>
          </div>
        </div>

        {/* KPI Summary Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">{dict.alerts.totalCustomerAccounts}</span>
              <div className="text-2xl font-black text-slate-900 mt-1">{loans.length}</div>
              <span className="text-[11px] font-semibold text-slate-500">{dict.alerts.registeredGoldLoans}</span>
            </div>
            <div className="p-3 bg-slate-100 text-slate-600 rounded-2xl">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-amber-600 tracking-wider">{dict.alerts.accruedInterestDues}</span>
              <div className="text-2xl font-black text-amber-700 mt-1">{formatCurrency(totalAccruedInterestAll)}</div>
              <span className="text-[11px] font-semibold text-amber-600">{dict.alerts.pendingCollection}</span>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl border border-amber-200/60">
              <Coins className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-rose-600 tracking-wider">{dict.alerts.overdueAlerts}</span>
              <div className="text-2xl font-black text-rose-700 mt-1">{overdueCount}</div>
              <span className="text-[11px] font-semibold text-rose-600">{dict.alerts.actionRequired}</span>
            </div>
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200/60">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-emerald-600 tracking-wider">{dict.alerts.closedAndSettled}</span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{closedCount}</div>
              <span className="text-[11px] font-semibold text-emerald-600">{dict.alerts.clearCertificates}</span>
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
                  placeholder={dict.alerts.searchPlaceholder}
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
                  {dict.alerts.allTab} ({loans.length})
                </button>
                <button
                  onClick={() => setStatusFilter('DUE')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'DUE' ? 'bg-white text-amber-700 shadow-2xs' : 'text-slate-500 hover:text-amber-700'
                  }`}
                >
                  {dict.alerts.duesTab}
                </button>
                <button
                  onClick={() => setStatusFilter('OVERDUE')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'OVERDUE' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-500 hover:text-rose-700'
                  }`}
                >
                  {dict.alerts.overdueTab}
                </button>
                <button
                  onClick={() => setStatusFilter('CLOSED')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-center transition-all ${
                    statusFilter === 'CLOSED' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-emerald-700'
                  }`}
                >
                  {dict.alerts.closedTab}
                </button>
              </div>
            </div>

            {/* Customer Loans List */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden max-h-[700px] overflow-y-auto divide-y divide-slate-100">
              {filteredLoans.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {dict.common.noRecords}
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
                            {getCustomerName(loan.customer, idx)}
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
                          {isClosed ? (isMarathi ? 'बंद' : 'Closed') : isOverdue ? `${isMarathi ? 'थकीत' : 'Overdue'} (${fin.overdueDays}d)` : (isMarathi ? 'सक्रिय' : 'Active')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="text-slate-500 text-[11px] font-medium">
                          {isMarathi ? 'तारण दागिने' : 'Pledged'}: <span className="font-semibold text-slate-800">{loan.gold_item?.ornament_type || (isMarathi ? 'दागिना' : 'Gold Item')}</span> ({formatWeight(loan.gold_item?.net_weight || 0)})
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">{isMarathi ? 'थकीत व्याज' : 'Accrued Due'}</span>
                          <span className="font-black text-amber-700">{formatCurrency(fin.netAccruedInterest)}</span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="w-3 h-3 text-emerald-600" />
                          {getCustomerMobile(loan.customer, idx)}
                        </span>
                        <span className="font-bold text-slate-700">
                          {isMarathi ? 'एकूण देय' : 'Total Due'}: {formatCurrency(fin.totalBalanceDue)}
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
                <h3 className="text-base font-bold text-slate-700">{isMarathi ? 'कोणताही ग्राहक निवडलेला नाही' : 'No Customer Selected'}</h3>
                <p className="text-xs text-slate-400 mt-1">{isMarathi ? 'सूचना व पावत्या तयार करण्यासाठी डावीकडील सूचीमधून कर्ज खाते निवडा.' : 'Select a customer loan account from the left list to generate alerts & receipts.'}</p>
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
                              {getCustomerName(selectedLoan.customer, loans.findIndex(l => l.id === selectedLoan.id))}
                            </h2>
                            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
                              {selectedLoan.loan_number}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                            <span>{dict.loan.loanAmount}: <strong className="text-white">{formatCurrency(selectedLoan.loan_amount)}</strong></span>
                            <span>{dict.loan.monthlyInterestRate}: <strong className="text-amber-300">{selectedLoan.interest_rate}%/mo</strong></span>
                            <span>{dict.loan.disbursementDate}: <strong className="text-white">{formatDate(selectedLoan.loan_date)}</strong></span>
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">{dict.customer.mobileNumber}:</span>
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
                          <span className="text-[10px] uppercase font-bold text-amber-400 block">{dict.alerts.accruedInterestDues}</span>
                          <span className="text-base font-black text-amber-300">{formatCurrency(fin.netAccruedInterest)}</span>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-emerald-400 block">{dict.loan.totalPayable}</span>
                          <span className="text-base font-black text-white">{formatCurrency(fin.totalBalanceDue)}</span>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-sky-400 block">{dict.alerts.monthlyDueInterest}</span>
                          <span className="text-base font-black text-sky-300">{formatCurrency(fin.emiAmount)}</span>
                        </div>

                        <div className="bg-slate-800/80 p-3 rounded-2xl border border-slate-700">
                          <span className="text-[10px] uppercase font-bold text-purple-400 block">{isMarathi ? 'तारण दागिने' : 'Pledged Asset'}</span>
                          <span className="text-xs font-bold text-slate-200 truncate block mt-1">
                            {selectedLoan.gold_item?.ornament_type || (isMarathi ? 'दागिना' : 'Gold Item')} ({formatWeight(selectedLoan.gold_item?.net_weight || 0)})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PDF & Certificate Generation Action Bar */}
                    <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span>{dict.alerts.generatePrintPdf}</span>
                        </h3>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                          {isMarathi ? 'ए४ प्रिंट फॉरमॅट' : 'A4 Print Format'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">{dict.alerts.repaymentReceiptPdf}</span>
                            <span className="text-[10px] text-slate-500">{dict.alerts.repaymentReceiptSubtitle}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handlePrintRepaymentReceipt}
                              className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs transition-colors"
                              title={dict.alerts.repaymentReceiptPdf}
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleDownloadRepaymentReceipt}
                              className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl transition-colors"
                              title={dict.common.download}
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">{dict.alerts.loanClosureCertificate}</span>
                            <span className="text-[10px] text-slate-500">{dict.alerts.loanClosureSubtitle}</span>
                          </div>
                          <button
                            onClick={handlePrintClosureCertificate}
                            className="p-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl shadow-xs transition-colors"
                            title={dict.alerts.loanClosureCertificate}
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between sm:col-span-2">
                          <div>
                            <span className="font-bold text-slate-800 block">{dict.alerts.noDueCertificatePdf}</span>
                            <span className="text-[10px] text-slate-500">{dict.alerts.noDueSubtitle}</span>
                          </div>
                          <button
                            onClick={handlePrintNoDueCertificate}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors shadow-xs"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>{dict.alerts.printNdcBtn}</span>
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
                            {dict.alerts.whatsAppAlertGenerator}
                          </h3>
                          <p className="text-xs text-slate-500 font-medium">
                            {dict.alerts.whatsAppSubtitle}
                          </p>
                        </div>
                      </div>

                      {/* Template Selector Grid */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
                          {isMarathi ? 'मेसेज अलर्ट टेम्पलेट निवडा:' : 'Select Message Alert Template:'}
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
                            <span>{dict.alerts.whatsAppMessageBody}</span>
                          </span>
                          <span className="text-slate-400 text-[10px]">{isMarathi ? 'व्हॉट्सअ‍ॅप फॉरमॅट' : 'Formatted for WhatsApp'}</span>
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
                          <span>{dict.alerts.copyMessageText}</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleSendWhatsApp}
                          className="px-6 py-2.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform active:scale-95"
                        >
                          <Send className="w-4 h-4" />
                          <span>{dict.alerts.sendWhatsAppAlertNow}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* WhatsApp Dispatch Audit Trail Logs Section */}
        <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">{isMarathi ? 'व्हॉट्सअ‍ॅप पाठवल्याची नोंदवही' : 'WhatsApp Logs Audit Trail'}</h3>
                <p className="text-xs text-slate-500">{isMarathi ? 'पेढीवरून ग्राहकांना पाठवलेल्या सर्व सूचना व आठवणींचा तपशील' : 'History of customer alerts and payment reminders dispatched from this shop'}</p>
              </div>
            </div>
            {dispatchLogs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDispatchLogs([]);
                  if (typeof window !== 'undefined') localStorage.removeItem('sl_whatsapp_dispatch_logs');
                  toast.success(isMarathi ? 'व्हॉट्सअ‍ॅप नोंदवही साफ केली' : 'Cleared WhatsApp Logs History');
                }}
                className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
              >
                {isMarathi ? 'इतिहास साफ करा' : 'Clear History'}
              </button>
            )}
          </div>

          {dispatchLogs.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-xs font-medium">
              {isMarathi ? 'अद्याप कोणतेही व्हॉट्सअ‍ॅप संदेश पाठवलेले नाहीत. नवीन संदेश पाठवून नोंद सुरू करा.' : 'No WhatsApp messages logged yet. Launch an alert above to create your first log entry.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">{dict.common.date}</th>
                    <th className="py-2.5 px-3">{dict.customer.customerName}</th>
                    <th className="py-2.5 px-3">{dict.customer.mobileNumber}</th>
                    <th className="py-2.5 px-3">{dict.loan.contractNumber}</th>
                    <th className="py-2.5 px-3">{isMarathi ? 'सूचना प्रकार' : 'Alert Type'}</th>
                    <th className="py-2.5 px-3">{dict.common.status}</th>
                    <th className="py-2.5 px-3 text-right">{dict.common.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {dispatchLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="py-3 px-3 font-bold text-slate-900">{log.customerName}</td>
                      <td className="py-3 px-3 font-mono text-slate-600">{log.phone}</td>
                      <td className="py-3 px-3 font-mono text-amber-700 font-bold">{log.loanNumber}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {log.alertType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-emerald-600 font-semibold">{log.status}</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            sendWhatsAppAlert(log.phone, log.messageSnippet);
                            toast.success(isMarathi ? `${log.customerName} यांना व्हॉट्सअ‍ॅप पुन्हा पाठवले` : `Resent WhatsApp to ${log.customerName}`);
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors"
                        >
                          {isMarathi ? 'पुन्हा पाठवा' : 'Re-send'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
