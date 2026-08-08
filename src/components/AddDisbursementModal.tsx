'use client';

// ========================================================
// SuvarnaLoan ERP - Add Additional Loan Disbursement Modal
// Supports English & Bank-Grade Marathi Localization
// Location: src/components/AddDisbursementModal.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Plus, X, Coins, ShieldCheck, Calculator, AlertTriangle, ArrowRight, CheckCircle2, Wallet, Calendar } from 'lucide-react';
import { db } from '../lib/supabase/supabaseDb';
import { Loan, LoanDisbursement } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { calculateGoldValuation } from '../lib/goldValuationEngine';
import { toast } from 'sonner';
import { useTranslation } from '../providers/LanguageProvider';

interface AddDisbursementModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSuccess?: () => void;
}

export function AddDisbursementModal({
  isOpen,
  onClose,
  loan,
  onSuccess,
}: AddDisbursementModalProps) {
  const { dict, language, isMarathi } = useTranslation();

  const [amount, setAmount] = useState<number>(50000);
  const [interestRate, setInterestRate] = useState<number>(1.5);
  const [disbursementDate, setDisbursementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [interestStartDate, setInterestStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque'>('Cash');
  const [notes, setNotes] = useState<string>('Additional top-up loan against existing pledged gold');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (loan) {
      setInterestRate(loan.interest_rate || 1.5);
      setTenureMonths(loan.tenure_months || 12);
      setDisbursementDate(new Date().toISOString().split('T')[0]);
      setInterestStartDate(new Date().toISOString().split('T')[0]);
      setNotes(isMarathi ? 'सध्याच्या तारण सोन्यावर अतिरिक्त कर्ज वितरण (टॉप-अप)' : 'Additional top-up loan against existing pledged gold');
    }
  }, [loan, isOpen, isMarathi]);

  if (!isOpen || !loan) return null;

  // Existing cumulative principal
  const rawExistingDisbursements = loan.disbursements || [];
  const existingDisbursements = rawExistingDisbursements.length > 0 && rawExistingDisbursements.some(d => d.disbursement_number === 1)
    ? rawExistingDisbursements
    : [
        {
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
          principal_outstanding: loan.status === 'Closed' ? 0 : loan.loan_amount,
          payment_method: 'Cash',
          notes: 'Initial Gold Pledge Disbursement',
          created_at: loan.created_at,
        },
        ...rawExistingDisbursements.filter(d => d.disbursement_number !== 1)
      ];

  const existingPrincipal = existingDisbursements.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const nextTrancheNumber = existingDisbursements.length + 1;
  const newCumulativePrincipal = existingPrincipal + (Number(amount) || 0);

  // Appraised Gold Valuation
  const goldValuation = loan.gold_item ? calculateGoldValuation({
    metalType: loan.gold_item.metal_type || 'Gold',
    grossWeightGrams: loan.gold_item.gross_weight,
    stoneWeightGrams: loan.gold_item.stone_weight,
    purityKarat: loan.gold_item.purity,
    goldRatePerGram24K: 7650,
    ltvPercentage: 75,
  }) : { estimatedMarketValue: 100000, maxLoanAmount: 75000 };

  const marketValue = loan.gold_item?.estimated_value || goldValuation.estimatedMarketValue;
  const maxLtv75 = Math.round(marketValue * 0.75);
  const maxLtv80 = Math.round(marketValue * 0.80);
  const availableCreditHeadroom = Math.max(0, maxLtv75 - existingPrincipal);
  const isOverLtvLimit = newCumulativePrincipal > maxLtv80;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || amount <= 0) {
      toast.error(isMarathi ? 'कृपया वैध कर्ज रक्कम प्रविष्ट करा' : 'Please enter a valid disbursement amount');
      return;
    }

    setLoading(true);
    try {
      const ok = await db.addLoanDisbursement(loan.id, {
        amount: Number(amount),
        interest_rate: Number(interestRate) || 1.5,
        disbursement_date: disbursementDate,
        interest_start_date: interestStartDate,
        due_date: new Date(new Date(disbursementDate).getTime() + (Number(tenureMonths) || 12) * 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
        tenure_months: Number(tenureMonths) || 12,
        payment_method: paymentMethod,
        notes: notes || (isMarathi ? `अतिरिक्त कर्ज वितरण टप्पा #${nextTrancheNumber}` : `Top-up tranche #${nextTrancheNumber}`),
        shop_id: loan.shop_id,
      });

      if (ok) {
        toast.success(
          isMarathi
            ? `अतिरिक्त कर्ज ${formatCurrency(amount)} यशस्वीरित्या वितरित केले! नवीन एकूण मुद्दल: ${formatCurrency(newCumulativePrincipal)}`
            : `Top-up disbursement of ${formatCurrency(amount)} issued successfully! New Cumulative Principal: ${formatCurrency(newCumulativePrincipal)}`
        );
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(isMarathi ? 'अतिरिक्त कर्ज वितरण करण्यात त्रुटी' : 'Failed to add top-up disbursement');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating disbursement tranche');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-sm">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isMarathi ? `अतिरिक्त कर्ज वितरण (टॉप-अप #${nextTrancheNumber})` : `Add Additional Loan Amount (Top-Up #${nextTrancheNumber})`}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {isMarathi ? 'त्याच सोन्याच्या तारणावर नवीन मुद्दल रक्कम वितरित करा' : 'Same Gold Item Collateral • Independent Interest Calculations'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Collateral Gold Item & LTV Status Banner */}
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-amber-600" />
              <span>{loan.gold_item?.ornament_type || (isMarathi ? 'तारण सोन्याचे दागिने' : 'Pledged Gold Collateral')}</span>
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-200 text-amber-900">
              {loan.gold_item?.purity || '22K (91.6%)'} • {loan.gold_item?.net_weight || 0}g
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1 border-t border-amber-200/60">
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase">{dict.goldItem.appraisedValue}</span>
              <strong className="text-xs font-extrabold text-slate-900 block">{formatCurrency(marketValue)}</strong>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase">{dict.disbursement.existingPrincipal}</span>
              <strong className="text-xs font-extrabold text-amber-800 block">{formatCurrency(existingPrincipal)}</strong>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-500 uppercase">{dict.disbursement.availableHeadroom}</span>
              <strong className="text-xs font-extrabold text-emerald-700 block">{formatCurrency(availableCreditHeadroom)}</strong>
            </div>
          </div>
        </div>

        {/* Impact Analysis Banner */}
        <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between text-xs font-bold">
          <div>
            <span className="text-slate-400 text-[10px] block uppercase">{dict.disbursement.newTotalPrincipal}</span>
            <span className="text-base text-amber-300 font-extrabold">{formatCurrency(newCumulativePrincipal)}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-400 text-[10px] block uppercase">{isMarathi ? 'नवीन एकत्रित LTV' : 'New Cumulative LTV'}</span>
            <span className={`text-sm font-extrabold ${isOverLtvLimit ? 'text-rose-400' : 'text-emerald-400'}`}>
              {Math.round((newCumulativePrincipal / marketValue) * 100)}% LTV
            </span>
          </div>
        </div>

        {isOverLtvLimit && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              {isMarathi
                ? `⚠️ LTV चेतावणी: एकत्रित मुद्दल रक्कम ${formatCurrency(newCumulativePrincipal)} ८०% LTV मर्यादेपेक्षा जास्त आहे.`
                : `⚠️ High LTV Warning: Cumulative principal of ${formatCurrency(newCumulativePrincipal)} exceeds standard 80% LTV (${formatCurrency(maxLtv80)}). Proceed with caution.`
              }
            </span>
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {isMarathi ? 'अतिरिक्त कर्ज रक्कम (₹) *' : 'Additional Top-up Amount (₹) *'}
              </label>
              <input
                type="number"
                min="100"
                step="100"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.loan.interestRate} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.1"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.loan.disbursementDate} *
              </label>
              <input
                type="date"
                value={disbursementDate}
                onChange={(e) => {
                  setDisbursementDate(e.target.value);
                  setInterestStartDate(e.target.value);
                }}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.loan.interestStartDate} *
              </label>
              <input
                type="date"
                value={interestStartDate}
                onChange={(e) => setInterestStartDate(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.disbursement.disbursementMode} *
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Cash">{dict.disbursement.cashInHand}</option>
                <option value="Bank Transfer">{dict.disbursement.bankTransfer}</option>
                <option value="UPI">{dict.disbursement.upiInstant}</option>
                <option value="Cheque">{dict.disbursement.cheque}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.loan.tenure}
              </label>
              <select
                value={tenureMonths}
                onChange={(e) => setTenureMonths(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value={3}>3 {isMarathi ? 'महिने' : 'Months'}</option>
                <option value={6}>6 {isMarathi ? 'महिने' : 'Months'}</option>
                <option value={12}>12 {isMarathi ? 'महिने (मानक)' : 'Months (Standard)'}</option>
                <option value={24}>24 {isMarathi ? 'महिने' : 'Months'}</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {dict.disbursement.voucherNotes}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isMarathi ? 'उदा. त्याच सोन्याच्या हारावर अतिरिक्त टॉप-अप कर्ज' : 'e.g. Additional top-up loan against same gold necklace'}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              {dict.common.cancel}
            </button>

            <button
              type="submit"
              disabled={loading || amount <= 0}
              className="px-5 py-2.5 text-xs font-extrabold bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl shadow-md gold-glow flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {loading
                  ? dict.common.processing
                  : (isMarathi
                      ? `टप्पा #${nextTrancheNumber} वितरित करा (${formatCurrency(amount)})`
                      : `Disburse Tranche #${nextTrancheNumber} (${formatCurrency(amount)})`
                    )
                }
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
