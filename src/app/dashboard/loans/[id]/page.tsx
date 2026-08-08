'use client';

// ========================================================
// SuvarnaLoan ERP - Individual Loan Detail & Multi-Tranche Disbursement Management
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/loans/[id]/page.tsx
// ========================================================

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Coins,
  Receipt,
  UserCheck,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Plus,
  X,
  ShieldCheck,
  Eye,
  Download,
  Camera,
  FileCheck,
  Phone,
  MapPin,
  Lock,
  Save,
  Image as ImageIcon,
  MessageSquare,
  Layers,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import DashboardLayout from '../../../../components/DashboardLayout';
import { TouchCard } from '../../../../components/ui/TouchCard';
import { RecordRepaymentModal } from '../../../../components/RecordRepaymentModal';
import { AddDisbursementModal } from '../../../../components/AddDisbursementModal';
import { LoanClosureCelebrationModal } from '../../../../components/LoanClosureCelebrationModal';
import { WhatsAppAlertModal } from '../../../../components/WhatsAppAlertModal';
import { db, clearDbCache } from '../../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../../lib/supabase/client';
import { logAuditEvent } from '../../../../lib/auditLog';
import { Loan, LoanDisbursement, Payment } from '../../../../types';
import { formatCurrency, formatWeight, formatDate } from '../../../../lib/utils';
import { calculateLoanFinancials, calculateGoldValuation, calculateReducingBalanceSchedule } from '../../../../lib/goldValuationEngine';
import {
  generateEnterpriseLoanStatementHTML,
  printHTMLDocument,
  printSinglePaymentReceiptPDF,
} from '../../../../lib/closureDocumentGenerator';
import { toast } from 'sonner';
import { useTranslation } from '../../../../providers/LanguageProvider';

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { dict, language, isMarathi } = useTranslation();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [targetTrancheId, setTargetTrancheId] = useState<string>('ALL');
  const [addDisbModalOpen, setAddDisbModalOpen] = useState(false);
  const [celebrationModalOpen, setCelebrationModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);

  // Live gold rate from shop settings
  const [goldRate24k, setGoldRate24k] = useState<number>(7650);

  // Mobile edit state
  const [editableMobile, setEditableMobile] = useState('');
  const [savingMobile, setSavingMobile] = useState(false);

  const loadLoan = async () => {
    setLoading(true);
    clearDbCache();
    const data = await db.getLoanById(resolvedParams.id);
    setLoan(data);
    if (data && data.customer) {
      setEditableMobile(data.customer.mobile_number);
    }
    // Fetch live gold rate from shop settings
    const session = getSessionUser();
    const activeShopId = data?.shop_id || session?.user?.shop_id || session?.shop?.id || '';
    if (activeShopId) {
      const shop = await db.getShop(activeShopId);
      if (shop && shop.gold_rate_24k) {
        setGoldRate24k(shop.gold_rate_24k);
      }
    }
    setLoading(false);
  };

  const handleDownloadDocument = (url: string, filename: string) => {
    if (!url) {
      toast.error(isMarathi ? "दस्तऐवज फाइल उपलब्ध नाही" : "Document file not available for download");
      return;
    }
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(isMarathi ? `डाउनलोड झाले: ${filename}` : `Downloaded ${filename}`);
    } catch (err) {
      toast.error(isMarathi ? "दस्तऐवज डाउनलोड करण्यात त्रुटी" : "Failed to download document");
    }
  };

  const handleSaveMobile = async () => {
    if (!loan || !loan.customer) return;
    if (!editableMobile || editableMobile.trim().length < 8) {
      toast.error(isMarathi ? "कृपया वैध मोबाईल क्रमांक प्रविष्ट करा" : "Please enter a valid mobile phone number");
      return;
    }

    setSavingMobile(true);
    try {
      const session = getSessionUser();
      const activeShopId = loan.shop_id || session?.user?.shop_id || session?.shop?.id || '';
      await logAuditEvent(
        activeShopId,
        'user-001',
        'Shop Owner',
        'UPDATE',
        'Customer Mobile Number',
        loan.customer.id,
        `Updated customer mobile from ${loan.customer.mobile_number} to ${editableMobile.trim()}`
      );

      const ok = await db.updateCustomerMobile(loan.customer.id, editableMobile.trim());

      if (ok) {
        toast.success(isMarathi ? "ग्राहकाचा मोबाईल क्रमांक यशस्वीरित्या जतन केला!" : "Customer mobile phone updated successfully!");
        setLoan((prev) =>
          prev
            ? {
                ...prev,
                customer: prev.customer ? { ...prev.customer, mobile_number: editableMobile.trim() } : prev.customer,
              }
            : null
        );
      } else {
        toast.error(isMarathi ? "मोबाईल क्रमांक जतन करण्यात त्रुटी" : "Failed to update mobile number");
      }
    } catch (err) {
      toast.error(isMarathi ? "मोबाईल क्रमांक जतन करण्यात त्रुटी" : "Failed to update mobile number");
    } finally {
      setSavingMobile(false);
    }
  };

  const handlePrintEnterpriseStatement = () => {
    if (!loan) return;
    const session = getSessionUser();
    const html = generateEnterpriseLoanStatementHTML({
      loan,
      shop: session?.shop || null,
      closedBy: session?.user?.name || 'Authorized Cashier',
      language,
    });
    printHTMLDocument(html);
  };

  const handlePrintPaymentReceipt = (payment: Payment) => {
    const session = getSessionUser();
    printSinglePaymentReceiptPDF(payment, session?.shop || null, language);
  };

  useEffect(() => {
    loadLoan();

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'loans' || e.detail.table === 'payments' || e.detail.table === 'loan_disbursements') {
        loadLoan();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', () => loadLoan());
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', () => loadLoan());
      }
    };
  }, [resolvedParams.id]);

  if (loading || !loan) {
    return (
      <DashboardLayout>
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-slate-200 rounded-lg w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
            <div className="h-64 bg-slate-200 rounded-2xl"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const rawDisbursements = Array.isArray(loan.disbursements) ? loan.disbursements : [];
  let tranches: LoanDisbursement[] = [...rawDisbursements];
  if (!tranches.some(t => t.disbursement_number === 1)) {
    const initialDisb: LoanDisbursement = {
      id: `disb-${loan.id}-1`,
      loan_id: loan.id,
      shop_id: loan.shop_id,
      disbursement_number: 1,
      amount: Number(loan.loan_amount) || 0,
      interest_rate: loan.interest_rate,
      disbursement_date: loan.loan_date,
      interest_start_date: loan.loan_date,
      due_date: loan.due_date,
      tenure_months: loan.tenure_months || 12,
      status: loan.status === 'Closed' ? 'Settled' : 'Active',
      principal_outstanding: loan.status === 'Closed' ? 0 : Number(loan.loan_amount),
      payment_method: 'Cash',
      notes: isMarathi ? 'मूळ सुवर्ण तारण कर्ज वितरण #१' : 'Initial Gold Pledge Disbursement #1',
      created_at: loan.created_at,
    };
    tranches = [initialDisb, ...tranches];
  }
  tranches.sort((a, b) => (a.disbursement_number || 1) - (b.disbursement_number || 1));

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments,
    loan.repayment_model || 'Bullet Repayment',
    loan.tenure_months || 12,
    tranches
  );

  // Appraised Gold Valuation
  const goldValuation = loan.gold_item ? calculateGoldValuation({
    metalType: loan.gold_item.metal_type || 'Gold',
    grossWeightGrams: loan.gold_item.gross_weight,
    stoneWeightGrams: loan.gold_item.stone_weight,
    purityKarat: loan.gold_item.purity,
    goldRatePerGram24K: goldRate24k,
    ltvPercentage: 75,
  }) : { estimatedMarketValue: 100000, maxLoanAmount: 75000 };

  const marketValue = loan.gold_item?.estimated_value || goldValuation.estimatedMarketValue;
  const totalDisbursed = financials.totalDisbursed || loan.loan_amount;
  const totalPrincipalOutstanding = financials.remainingPrincipal;
  const totalInterestOutstanding = financials.netAccruedInterest;
  const totalPayable = financials.totalBalanceDue;

  const handleOpenRepayTranche = (trancheId: string) => {
    setTargetTrancheId(trancheId);
    setPayModalOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/loans"
              className="p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900">
                  {isMarathi ? 'सुवर्ण कर्ज खाते' : 'Gold Loan'} {loan.loan_number}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    loan.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : loan.status === 'Overdue'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {loan.status === 'Active' ? dict.common.active : loan.status === 'Overdue' ? dict.common.overdue : dict.common.closed}
                </span>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  {tranches.length > 1
                    ? (isMarathi ? `⚡ एकाधिक वितरण (${tranches.length} टप्पे)` : `⚡ Multi-Tranche (${tranches.length} Disbursements)`)
                    : dict.loan.singleTranche
                  }
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                {isMarathi
                  ? `वितरण दिनांक: ${formatDate(loan.loan_date)} • मुदत: ${loan.tenure_months || 12} महिने`
                  : `Initial Disbursement on ${formatDate(loan.loan_date)} • Tenure: ${loan.tenure_months || 12} Months`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrintEnterpriseStatement}
              className="px-3.5 py-2 text-xs font-extrabold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-all"
              title="Print Enterprise Banking Grade Loan Statement PDF"
            >
              <Printer className="w-4 h-4 text-amber-100" />
              <span>{isMarathi ? 'खाते विवरण 📜' : 'Enterprise Statement 📜'}</span>
            </button>

            {loan.status !== 'Closed' && (
              <>
                <button
                  onClick={() => setAddDisbModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/30 rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                  title="Add Additional Loan Amount Against This Same Gold Pledge"
                >
                  <Plus className="w-4 h-4 text-amber-400" />
                  <span>{dict.loan.addTopUp}</span>
                </button>

                <button
                  onClick={() => handleOpenRepayTranche('ALL')}
                  className="px-4 py-2 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl shadow-md gold-glow hover:bg-amber-600 flex items-center gap-1.5 font-black"
                >
                  <Receipt className="w-4 h-4" />
                  <span>{dict.loan.recordRepayment}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Auction Eligibility Alert Banner */}
        {financials.isAuctionEligible && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-3 text-rose-950 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                  {isMarathi
                    ? `🚨 लिलावास पात्र - ${financials.overdueDays} दिवस थकीत`
                    : `🚨 AUCTION ELIGIBLE - OVERDUE BY ${financials.overdueDays} DAYS`
                  }
                </h4>
                <p className="text-xs font-medium text-rose-800">
                  {isMarathi
                    ? 'ग्राहकाची मुदत ३० दिवसांपेक्षा जास्त थकीत झाली आहे. नियमांनुसार सोन्याचा लिलाव प्रक्रिया सुरू केली जाऊ शकते.'
                    : 'Borrower has defaulted past the 30-day grace period. Pledged gold ornaments may be initiated for public auction recovery.'
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => handleOpenRepayTranche('ALL')}
              className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shrink-0 shadow-2xs"
            >
              {isMarathi ? 'लिलावापूर्वी वसुली करा' : 'Collect Dues Before Auction'}
            </button>
          </div>
        )}

        {/* Section 1: Loan Summary Dashboard (Unified Combined Metrics) */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950 text-white rounded-2xl p-5 shadow-lg border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-extrabold text-white tracking-wide uppercase">
                {isMarathi ? 'सुवर्ण कर्ज एकत्रित तपशील व आर्थिक विश्लेषण' : 'Gold Loan Combined Summary & Portfolio Metrics'}
              </h2>
            </div>
            <span className="text-[11px] font-bold text-amber-300 bg-amber-900/50 px-2.5 py-0.5 rounded-full border border-amber-700/60">
              {isMarathi ? `एकच तारण • ${tranches.length} कर्ज वितरण टप्पे` : `One Pledge • ${tranches.length} Disbursement Tranches`}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {dict.goldItem.appraisedValue}
              </span>
              <strong className="text-base sm:text-lg font-black text-amber-300 mt-1 block">{formatCurrency(marketValue)}</strong>
              <span className="text-[9px] text-slate-400 mt-0.5 block">{loan.gold_item?.net_weight || 0}g {isMarathi ? 'शुद्ध सोने' : 'Pure Gold'}</span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {dict.loan.disbursedAmount}
              </span>
              <strong className="text-base sm:text-lg font-black text-white mt-1 block">{formatCurrency(totalDisbursed)}</strong>
              <span className="text-[9px] text-slate-400 mt-0.5 block">
                {tranches.length} {isMarathi ? 'टप्पे' : 'Tranches'}
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {dict.loan.principalOutstanding}
              </span>
              <strong className="text-base sm:text-lg font-black text-amber-400 mt-1 block">{formatCurrency(totalPrincipalOutstanding)}</strong>
              <span className="text-[9px] text-emerald-400 mt-0.5 block">
                {isMarathi ? 'जमा:' : 'Paid:'} {formatCurrency(financials.totalPrincipalPaid)}
              </span>
            </div>

            <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {dict.loan.accruedInterest}
              </span>
              <strong className="text-base sm:text-lg font-black text-rose-400 mt-1 block">{formatCurrency(totalInterestOutstanding)}</strong>
              <span className="text-[9px] text-emerald-400 mt-0.5 block">
                {isMarathi ? 'जमा:' : 'Paid:'} {formatCurrency(financials.totalInterestPaid)}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gradient-to-r from-amber-600 to-amber-700 p-3 rounded-xl border border-amber-400 shadow-md">
              <span className="text-[10px] font-black text-slate-950 uppercase tracking-wider block">
                {dict.loan.totalPayable}
              </span>
              <strong className="text-base sm:text-lg font-black text-white mt-1 block">{formatCurrency(totalPayable)}</strong>
              <span className="text-[9px] text-amber-100 mt-0.5 block">
                {isMarathi ? 'मुद्दल + व्याज' : 'Principal + Interest'}
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Disbursement Tranche Breakdown & Independent Calculations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-slate-900">
              <Layers className="w-5 h-5 text-amber-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-900">{dict.disbursement.trancheTitle}</h3>
                <p className="text-[11px] text-slate-500 font-medium">{dict.disbursement.trancheSubtitle}</p>
              </div>
            </div>

            {loan.status !== 'Closed' && (
              <button
                type="button"
                onClick={() => setAddDisbModalOpen(true)}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1 shadow-2xs self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>{dict.disbursement.addDisbursementBtn}</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{dict.disbursement.trancheNumber}</th>
                  <th className="py-3 px-4">{dict.loan.disbursedAmount}</th>
                  <th className="py-3 px-4">{dict.loan.disbursementDate}</th>
                  <th className="py-3 px-4">{isMarathi ? 'व्याज कालावधी व दर' : 'Interest Period & Rate'}</th>
                  <th className="py-3 px-4">{dict.loan.accruedInterest}</th>
                  <th className="py-3 px-4">{dict.loan.principalOutstanding}</th>
                  <th className="py-3 px-4 text-right">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {financials.trancheBreakdown?.map((t, idx) => (
                  <tr key={t.disbursementId || idx} className="hover:bg-amber-50/20">
                    <td className="py-3.5 px-4 font-extrabold text-amber-700">
                      {isMarathi ? `वितरण टप्पा #${t.disbursementNumber}` : `Disbursement #${t.disbursementNumber}`}
                      {idx === 0 && (
                        <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold">
                          {isMarathi ? 'मूळ' : 'Initial'}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                      {formatCurrency(t.originalAmount)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-semibold text-slate-900">{formatDate(t.disbursementDate)}</div>
                      <div className="text-[10px] text-slate-400">
                        {t.elapsedDays} {isMarathi ? 'दिवस झाले' : 'days elapsed'} ({t.elapsedMonths} {isMarathi ? 'महिने' : 'mos'})
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{formatDate(t.disbursementDate)} → {formatDate(t.dueDate)}</div>
                      <div className="text-[10px] text-amber-700 font-semibold">{t.monthlyInterestRate}% / {isMarathi ? 'महिना' : 'Month'}</div>
                    </td>

                    <td className="py-3.5 px-4 font-black text-rose-600">
                      {formatCurrency(t.netAccruedInterest)}
                    </td>

                    <td className="py-3.5 px-4 font-black text-emerald-700">
                      {formatCurrency(t.remainingPrincipal)}
                      {t.remainingPrincipal <= 0 && (
                        <span className="ml-1 text-[9px] text-emerald-600 font-bold">({dict.common.settled})</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {loan.status !== 'Closed' && t.remainingPrincipal > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenRepayTranche(t.disbursementId)}
                          className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 shadow-2xs transition-all"
                        >
                          <Receipt className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isMarathi ? `टप्पा #${t.disbursementNumber} भरा` : `Repay Tranche #${t.disbursementNumber}`}</span>
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-600">✔ {dict.disbursement.paidInFull}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100/80 border-t-2 border-slate-300 text-xs font-black text-slate-900">
                  <td className="py-3 px-4 uppercase">{dict.disbursement.combinedTotalLoan}</td>
                  <td className="py-3 px-4 text-amber-800 text-sm">{formatCurrency(totalDisbursed)}</td>
                  <td className="py-3 px-4 text-slate-500">-</td>
                  <td className="py-3 px-4 text-slate-500">{isMarathi ? 'एकत्रित कालावधी' : 'Combined Period'}</td>
                  <td className="py-3 px-4 text-rose-700">{formatCurrency(totalInterestOutstanding)}</td>
                  <td className="py-3 px-4 text-emerald-700">{formatCurrency(totalPrincipalOutstanding)}</td>
                  <td className="py-3 px-4 text-right">
                    {loan.status !== 'Closed' && (
                      <button
                        type="button"
                        onClick={() => handleOpenRepayTranche('ALL')}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-black inline-flex items-center gap-1 shadow-2xs"
                      >
                        <span>{isMarathi ? 'संपूर्ण कर्ज भरा' : 'Repay Entire Loan'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section 3: Borrower Profile & Gold Ornament Collateral */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer CRM & KYC Document Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-amber-700">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">{dict.customer.title}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {dict.customer.kycVerified}
              </span>
            </div>

            {/* Borrower Header with Photo */}
            <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-amber-400 overflow-hidden shrink-0 flex items-center justify-center font-extrabold text-amber-300 text-lg">
                {loan.customer?.photo_url ? (
                  <img src={loan.customer.photo_url} alt={loan.customer.full_name} className="w-full h-full object-cover" />
                ) : (
                  loan.customer?.full_name?.[0] || 'C'
                )}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">{loan.customer?.full_name}</h4>
                <p className="text-xs text-slate-500 font-medium">Customer ID: {loan.customer_id}</p>
              </div>
            </div>

            {/* Editable Mobile Phone Section */}
            <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 border border-slate-800">
              <label className="block text-[11px] font-bold text-amber-400 flex items-center justify-between">
                <span>{dict.customer.mobileNumber} (EDITABLE ✏️)</span>
                <span className="text-[9px] text-slate-400">Shop Owner Edit Access</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editableMobile}
                  onChange={(e) => setEditableMobile(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-extrabold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSaveMobile}
                  disabled={savingMobile}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMobile ? dict.common.saving : dict.common.save}</span>
                </button>
              </div>
            </div>

            {/* Locked KYC Fields */}
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                  <span>{dict.customer.aadhaarNumber}</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </div>
                <strong className="text-slate-900 text-xs block mt-0.5">{loan.customer?.aadhaar_number || 'N/A'}</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                  <span>{dict.customer.panNumber}</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </div>
                <strong className="text-slate-900 text-xs block mt-0.5">{loan.customer?.pan_number || 'N/A'}</strong>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
              <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                <span>{dict.customer.address}</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </div>
              <p className="text-slate-800 font-semibold mt-0.5">{loan.customer?.address || 'Address on file'}</p>
            </div>
          </div>

          {/* Gold Item Asset Card with Photo */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-amber-700">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">{dict.goldItem.title}</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                {loan.gold_item?.purity || '22K (91.6%)'}
              </span>
            </div>

            {/* Pledged Gold Image Snapshot Box */}
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Camera className="w-4 h-4" />
                  <span>{dict.goldItem.snapshot}</span>
                </span>
                {loan.gold_item?.photo_url && (
                  <span className="text-[10px] text-emerald-400 font-extrabold">WebP Compressed</span>
                )}
              </div>

              {loan.gold_item?.photo_url ? (
                <div className="h-44 bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
                  <img src={loan.gold_item.photo_url} alt={loan.gold_item.ornament_type} className="h-full w-auto object-contain" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDocModal({ title: `Pledged ${loan.gold_item?.ornament_type}`, url: loan.gold_item!.photo_url! })}
                      className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-lg flex items-center gap-1 shadow-md"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      <span>{dict.common.view}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(loan.gold_item!.photo_url!, `Pledged_${loan.gold_item?.ornament_type.replace(/\s+/g, '_')}.webp`)}
                      className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1 shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{dict.common.download}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-28 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium">
                  {isMarathi ? 'दागिन्याचे छायाचित्र उपलब्ध नाही' : 'No ornament photo uploaded'}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] font-bold uppercase">{dict.goldItem.ornamentType}</span>
                <strong className="text-slate-900 text-xs block mt-0.5">{loan.gold_item?.ornament_type || 'Gold Item'}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] font-bold uppercase">{dict.goldItem.vaultLocker}</span>
                <strong className="text-slate-900 text-xs block mt-0.5">{loan.gold_item?.pocket_locker_number || 'LOCKER-A-01'}</strong>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <span className="text-slate-500 text-[10px] font-bold uppercase">{dict.goldItem.grossWeight}</span>
                <strong className="text-slate-900 text-xs block mt-0.5">{formatWeight(loan.gold_item?.gross_weight)}</strong>
              </div>
              <div className="p-2.5 bg-amber-50/80 rounded-lg border border-amber-200">
                <span className="text-amber-800 text-[10px] font-bold uppercase">{dict.goldItem.netWeight}</span>
                <strong className="text-amber-950 text-xs block mt-0.5">{formatWeight(loan.gold_item?.net_weight)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Repayment Transaction Ledger */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">{dict.repayment.paymentLedger}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWaModalOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>{dict.nav.whatsapp}</span>
              </button>

              {loan.status === 'Closed' && (
                <button
                  type="button"
                  onClick={() => setCelebrationModalOpen(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{dict.closure.noDueCertificate}</span>
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{dict.repayment.receiptNumber}</th>
                  <th className="py-3 px-4">{dict.common.date}</th>
                  <th className="py-3 px-4">{dict.repayment.repaymentPurpose}</th>
                  <th className="py-3 px-4">{dict.repayment.paymentMethod}</th>
                  <th className="py-3 px-4">{dict.common.notes}</th>
                  <th className="py-3 px-4">{dict.common.total}</th>
                  <th className="py-3 px-4 text-right">{dict.common.actions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {!loan.payments || loan.payments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 font-medium">
                      {isMarathi ? 'कोणतेही भरणा व्यवहार नोंदवलेले नाहीत.' : 'No repayment transactions recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  loan.payments.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {p.receipt_number || `REC-2026-${(idx + 1).toString().padStart(4, '0')}`}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{p.payment_type}</td>
                      <td className="py-3.5 px-4">{p.payment_method}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{p.notes || '-'}</td>
                      <td className="py-3.5 px-4 font-black text-emerald-700">{formatCurrency(p.amount)}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handlePrintPaymentReceipt(p)}
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

        {/* Repayment Modal */}
        <RecordRepaymentModal
          isOpen={payModalOpen}
          loan={loan}
          preselectedTrancheId={targetTrancheId}
          onClose={() => setPayModalOpen(false)}
          onSuccess={() => {
            loadLoan();
            db.getLoanById(loan.id).then((fresh) => {
              if (fresh && fresh.status === 'Closed') {
                setCelebrationModalOpen(true);
              }
            });
          }}
        />

        {/* Add Top-Up Disbursement Modal */}
        <AddDisbursementModal
          isOpen={addDisbModalOpen}
          loan={loan}
          onClose={() => setAddDisbModalOpen(false)}
          onSuccess={() => loadLoan()}
        />

        {/* Closure Celebration Modal */}
        <LoanClosureCelebrationModal
          isOpen={celebrationModalOpen}
          loan={loan}
          onClose={() => setCelebrationModalOpen(false)}
        />

        {/* WhatsApp Alert Modal */}
        <WhatsAppAlertModal
          isOpen={waModalOpen}
          loan={loan}
          onClose={() => setWaModalOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}
