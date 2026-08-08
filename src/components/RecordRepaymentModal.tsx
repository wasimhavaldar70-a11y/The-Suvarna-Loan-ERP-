'use client';

// ========================================================
// SuvarnaLoan ERP - Record Loan Repayment Modal Component
// Supports Independent Tranche Selection & Combined Repayment
// Supports English & Bank-Grade Marathi Localization
// Location: src/components/RecordRepaymentModal.tsx
// ========================================================

import React, { useState, useEffect, useMemo } from 'react';
import { Receipt, X, Coins, CheckCircle2, Wallet, Calendar, ShieldCheck, Printer, ArrowRight, Send, Layers } from 'lucide-react';
import { db } from '../lib/supabase/supabaseDb';
import { Loan, LoanDisbursement } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { calculateLoanFinancials, calculateDisbursementFinancials } from '../lib/goldValuationEngine';
import { generateWhatsAppMessageText, sendWhatsAppAlert } from '../lib/whatsappNotificationHelper';
import { toast } from 'sonner';
import { useTranslation } from '../providers/LanguageProvider';

interface RecordRepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSuccess?: () => void;
  onLoanClosed?: (loan: Loan) => void;
  preselectedTrancheId?: string;
}

const METHOD_PRESETS: Record<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque', string> = {
  UPI: 'UTR: ',
  Cash: 'Cash in counter',
  'Bank Transfer': 'IMPS/NEFT Ref: ',
  Cheque: 'Cheque #: ',
};

export function RecordRepaymentModal({
  isOpen,
  onClose,
  loan,
  onSuccess,
  onLoanClosed,
  preselectedTrancheId,
}: RecordRepaymentModalProps) {
  const { dict, language, isMarathi } = useTranslation();

  const [selectedTrancheId, setSelectedTrancheId] = useState<string>(preselectedTrancheId || 'ALL');
  const [paymentType, setPaymentType] = useState<'Interest Payment' | 'Principal Part-Payment' | 'Full Settlement'>('Interest Payment');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'>('UPI');
  const [notes, setNotes] = useState(METHOD_PRESETS['UPI']);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (preselectedTrancheId) {
      setSelectedTrancheId(preselectedTrancheId);
    }
  }, [preselectedTrancheId, isOpen]);

  // Financial calculations for combined loan & tranches
  const combinedFin = useMemo(() => {
    if (!loan) return { netAccruedInterest: 0, totalBalanceDue: 0, totalInterestPaid: 0, remainingPrincipal: 0 };
    return calculateLoanFinancials(
      loan.loan_amount,
      loan.interest_rate,
      loan.loan_date,
      loan.due_date,
      loan.payments || [],
      loan.repayment_model || 'Bullet Repayment',
      loan.tenure_months || 12,
      loan.disbursements || []
    );
  }, [loan]);

  // If specific tranche is selected, compute its financial metrics
  const activeTranche = useMemo(() => {
    if (!loan || selectedTrancheId === 'ALL') return null;
    return (loan.disbursements || []).find(d => d.id === selectedTrancheId) || null;
  }, [loan, selectedTrancheId]);

  const activeFin = useMemo(() => {
    if (activeTranche) {
      return calculateDisbursementFinancials(
        activeTranche,
        loan?.payments || [],
        loan?.repayment_model || 'Bullet Repayment'
      );
    }
    return combinedFin;
  }, [activeTranche, combinedFin, loan]);

  // Adjust suggested payment amount when selection or payment type changes
  useEffect(() => {
    if (loan) {
      const targetAccrued = activeFin.netAccruedInterest;
      const targetPrincipal = activeFin.remainingPrincipal;
      const targetBalance = activeFin.totalBalanceDue;

      if (targetAccrued <= 0 && paymentType === 'Interest Payment') {
        setPaymentType('Principal Part-Payment');
      } else if (paymentType === 'Interest Payment') {
        setPaymentAmount(Math.max(0, targetAccrued));
      } else if (paymentType === 'Full Settlement') {
        setPaymentAmount(Math.max(0, targetBalance));
      } else if (paymentType === 'Principal Part-Payment') {
        setPaymentAmount(targetPrincipal > 0 ? Math.min(10000, targetPrincipal) : 0);
      }
    }
  }, [loan, selectedTrancheId, paymentType, activeFin]);

  if (!isOpen || !loan) return null;

  const processRepayment = async (sendWhatsApp: boolean) => {
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error(isMarathi ? 'कृपया वैध भरणा रक्कम प्रविष्ट करा' : 'Please enter a valid repayment amount');
      return;
    }

    if (paymentType === 'Interest Payment' && activeFin.netAccruedInterest <= 0) {
      toast.error(
        isMarathi
          ? '🚨 देय व्याज ₹० असल्यामुळे व्याज भरणा करता येत नाही. कृपया अंशतः मुद्दल किंवा पूर्ण परतफेड निवडा.'
          : '🚨 Interest Payment Restricted: This target currently has ₹0 accrued interest. Select Part Principal or Full Settlement instead.'
      );
      return;
    }

    if (!notes || notes.trim().length < 3) {
      toast.error(isMarathi ? 'कृपया पावती नोंद / व्हाउचर संदर्भ क्रमांक प्रविष्ट करा' : 'Receipt notes / voucher reference is mandatory');
      return;
    }

    setLoading(true);
    try {
      const isTargetingAll = selectedTrancheId === 'ALL';
      const activeTrancheNum = activeTranche?.disbursement_number;

      const savedPmt = await db.recordPayment({
        loan_id: loan.id,
        amount: paymentAmount,
        payment_type: paymentType,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        notes: `${notes.trim()} (recorded via ${paymentMethod}${!isTargetingAll ? ` for Tranche #${activeTrancheNum}` : ' for Combined Loan'})`,
        disbursement_id: isTargetingAll ? undefined : selectedTrancheId,
        disbursement_number: isTargetingAll ? undefined : activeTrancheNum,
      });

      const updatedRemainingPrincipal = Math.max(0, combinedFin.remainingPrincipal - (paymentType === 'Interest Payment' ? 0 : paymentAmount));
      const isClosed = paymentType === 'Full Settlement' || updatedRemainingPrincipal <= 0;

      toast.success(
        isMarathi
          ? `भरणा ${formatCurrency(paymentAmount)} यशस्वीरित्या नोंदविण्यात आला! (पावती #${savedPmt.receipt_number})`
          : `Repayment of ${formatCurrency(paymentAmount)} recorded successfully! (Receipt #${savedPmt.receipt_number})`
      );

      if (sendWhatsApp) {
        const waMessage = generateWhatsAppMessageText(
          isClosed ? 'LOAN_CLOSURE' : 'REPAYMENT_RECEIPT',
          { loan, payment: savedPmt, language }
        );
        sendWhatsAppAlert(loan.customer?.mobile_number, waMessage);
        toast.success(
          isMarathi
            ? `${loan.customer?.full_name || 'ग्राहकास'} व्हॉट्सॲप पावती पाठवण्यात आली.`
            : `Dispatched GST Receipt alert to ${loan.customer?.full_name || 'Customer'}`
        );
      }

      if (isClosed) {
        await db.updateLoanStatus(loan.id, 'Closed');
      }

      onClose();
      if (onSuccess) onSuccess();

      if (isClosed && onLoanClosed) {
        onLoanClosed({ ...loan, status: 'Closed' });
      }
    } catch (err) {
      console.error(err);
      toast.error(isMarathi ? 'भरणा नोंदवण्यात त्रुटी' : 'Failed to record repayment');
    } finally {
      setLoading(false);
    }
  };

  const tranches = loan.disbursements || [];

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-emerald-600">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">{dict.repayment.modalTitle}</h3>
              <p className="text-[11px] text-slate-500 font-semibold">
                {dict.loan.contractNumber}: {loan.loan_number} • {dict.customer.customerName}: {loan.customer?.full_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tranche Selector Dropdown */}
        {tranches.length > 1 && (
          <div className="my-3 p-3 bg-amber-50/80 rounded-xl border border-amber-200/80">
            <label className="block text-xs font-extrabold text-amber-900 mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-700" />
              <span>{dict.repayment.targetTranche}</span>
            </label>
            <select
              value={selectedTrancheId}
              onChange={(e) => setSelectedTrancheId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="ALL">
                {isMarathi
                  ? `🎯 संपूर्ण एकत्रित कर्ज (शिल्लक मुद्दल: ${formatCurrency(combinedFin.remainingPrincipal)})`
                  : `🎯 Entire Combined Loan (Total Principal: ${formatCurrency(combinedFin.remainingPrincipal)})`
                }
              </option>
              {tranches.map((t) => (
                <option key={t.id} value={t.id}>
                  {isMarathi
                    ? `वितरण टप्पा #${t.disbursement_number} — ${formatCurrency(t.amount)} (${formatDate(t.disbursement_date)}) • दर: ${t.interest_rate}%`
                    : `Disbursement #${t.disbursement_number} — ${formatCurrency(t.amount)} (${formatDate(t.disbursement_date)}) • Rate: ${t.interest_rate}%`
                  }
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Balance Quick Summary Card */}
        <div className="my-3 p-4 bg-slate-900 text-white rounded-2xl space-y-2 border border-slate-800 shadow-md">
          <div className="flex justify-between items-center text-xs text-slate-400 font-bold pb-2 border-b border-slate-800">
            <span>
              {isMarathi ? 'लक्ष्य:' : 'Target:'} {selectedTrancheId === 'ALL'
                ? dict.repayment.entireLoan
                : (isMarathi
                    ? `वितरण टप्पा #${activeTranche?.disbursement_number} (${formatCurrency(activeTranche?.amount || 0)})`
                    : `Disbursement #${activeTranche?.disbursement_number} (${formatCurrency(activeTranche?.amount || 0)})`
                  )
              }
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">
              {loan.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-slate-800/80 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold">{dict.loan.principalOutstanding}</span>
              <strong className="text-sm font-extrabold text-white">{formatCurrency(activeFin.remainingPrincipal)}</strong>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold">{dict.loan.accruedInterest}</span>
              <strong className="text-sm font-extrabold text-amber-400">
                {formatCurrency(activeFin.netAccruedInterest)}
              </strong>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] text-slate-400 block font-semibold">{dict.loan.totalPayable}</span>
              <strong className="text-sm font-black text-emerald-400">{formatCurrency(activeFin.totalBalanceDue)}</strong>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); processRepayment(true); }} className="space-y-4">
          {activeFin.netAccruedInterest <= 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>{dict.repayment.interestRestricted}</span>
            </div>
          )}

          {/* Payment Type Options */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">{dict.repayment.repaymentPurpose}</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (activeFin.netAccruedInterest <= 0) {
                    toast.error(
                      isMarathi
                        ? 'देय व्याज ₹० असल्यामुळे व्याज भरणा करता येत नाही.'
                        : '🚨 Interest Payment Restricted: ₹0 accrued interest. Select Part Principal or Full Settlement instead.'
                    );
                    return;
                  }
                  setPaymentType('Interest Payment');
                }}
                disabled={activeFin.netAccruedInterest <= 0}
                title={activeFin.netAccruedInterest <= 0 ? 'No accrued interest due' : 'Repay Interest Only'}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  activeFin.netAccruedInterest <= 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : paymentType === 'Interest Payment'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-400'
                }`}
              >
                💵 {dict.repayment.interestOnly} {activeFin.netAccruedInterest <= 0 && '(₹0 Due)'}
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('Principal Part-Payment')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  paymentType === 'Principal Part-Payment'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-400'
                }`}
              >
                📉 {dict.repayment.partPrincipal}
              </button>

              <button
                type="button"
                onClick={() => setPaymentType('Full Settlement')}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  paymentType === 'Full Settlement'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-500'
                }`}
              >
                🔒 {dict.repayment.fullSettlement}
              </button>
            </div>
          </div>

          {/* Amount & Method Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.repayment.repaymentAmount} <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-base font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">{dict.repayment.paymentMethod}</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="UPI">📱 {dict.disbursement.upiInstant}</option>
                <option value="Cash">💵 {dict.disbursement.cashInHand}</option>
                <option value="Bank Transfer">🏦 {dict.disbursement.bankTransfer}</option>
                <option value="Cheque">📜 {dict.disbursement.cheque}</option>
              </select>
            </div>
          </div>

          {/* Remarks Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {dict.repayment.receiptNotes} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder={
                paymentMethod === 'UPI'
                  ? 'e.g. UTR: 998234710293'
                  : paymentMethod === 'Cash'
                  ? (isMarathi ? 'उदा. रोख भरणा' : 'e.g. Cash in counter')
                  : paymentMethod === 'Bank Transfer'
                  ? 'e.g. IMPS/NEFT Ref: 88712345'
                  : 'e.g. Cheque #: 000142'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              required
            />
          </div>

          {/* Form Actions - Two Buttons: 1) Collect 2) Generate GST Receipt & Send */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {dict.common.cancel}
            </button>

            {/* Button 1: Collect Only */}
            <button
              type="button"
              disabled={loading}
              onClick={() => processRepayment(false)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>{loading ? dict.common.processing : dict.repayment.collectOnlyBtn}</span>
            </button>

            {/* Button 2: Generate GST Receipt & Send */}
            <button
              type="button"
              disabled={loading}
              onClick={() => processRepayment(true)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4 text-emerald-100" />
              <span>{loading ? dict.common.processing : dict.repayment.generateReceiptBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
