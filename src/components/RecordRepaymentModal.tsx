'use client';

// ========================================================
// SuvarnaLoan ERP - Record Loan Repayment Modal Component
// Location: src/components/RecordRepaymentModal.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Receipt, X, Coins, CheckCircle2, Wallet, Calendar, ShieldCheck, Printer, ArrowRight, Send } from 'lucide-react';
import { db } from '../lib/supabase/supabaseDb';
import { Loan } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { calculateLoanFinancials } from '../lib/goldValuationEngine';
import { generateWhatsAppMessageText, sendWhatsAppAlert } from '../lib/whatsappNotificationHelper';
import { toast } from 'sonner';

interface RecordRepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  onSuccess?: () => void;
  onLoanClosed?: (loan: Loan) => void;
}

export function RecordRepaymentModal({
  isOpen,
  onClose,
  loan,
  onSuccess,
  onLoanClosed,
}: RecordRepaymentModalProps) {
  const [paymentType, setPaymentType] = useState<'Interest Payment' | 'Principal Part-Payment' | 'Full Settlement'>('Interest Payment');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'>('UPI');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Financial calculations
  const fin = loan
    ? calculateLoanFinancials(loan.loan_amount, loan.interest_rate, loan.loan_date, loan.due_date, loan.payments)
    : { netAccruedInterest: 0, totalBalanceDue: 0, totalPaid: 0 };

  useEffect(() => {
    if (loan) {
      if (fin.netAccruedInterest <= 0 && paymentType === 'Interest Payment') {
        setPaymentType('Principal Part-Payment');
      } else if (paymentType === 'Interest Payment') {
        setPaymentAmount(Math.max(0, fin.netAccruedInterest || Math.round(loan.loan_amount * (loan.interest_rate / 100))));
      } else if (paymentType === 'Full Settlement') {
        setPaymentAmount(Math.max(0, fin.totalBalanceDue || loan.loan_amount));
      } else if (paymentType === 'Principal Part-Payment') {
        setPaymentAmount(Math.round(loan.loan_amount * 0.25));
      }
    }
  }, [paymentType, loan, fin.netAccruedInterest]);

  if (!isOpen || !loan) return null;

  const processRepayment = async (sendWhatsApp: boolean) => {
    if (paymentType === 'Interest Payment' && fin.netAccruedInterest <= 0) {
      toast.error('🚨 Interest Payment Not Allowed', {
        description: 'This loan currently has ₹0 accrued interest due. Interest repayment is only applicable when there is accrued interest.',
        duration: 6000,
      });
      alert('⚠️ Interest Repayment Restricted!\n\nThis loan currently has ₹0 accrued interest due.\n\nInterest payments can only be processed when there is pending accrued interest on the loan contract. Please select Part Principal or Full Settlement instead.');
      return;
    }

    if (paymentAmount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    setLoading(true);

    try {
      const newPayment = {
        id: `pay-${Date.now()}`,
        shop_id: loan.shop_id,
        loan_id: loan.id,
        payment_type: paymentType,
        amount: paymentAmount,
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: paymentMethod,
        notes: notes || `${paymentType} recorded via ${paymentMethod}`,
        created_at: new Date().toISOString(),
      };

      await db.recordPayment(newPayment);

      const isClosed = paymentType === 'Full Settlement' || paymentAmount >= fin.totalBalanceDue;

      if (isClosed) {
        await db.updateLoanStatus(loan.id, 'Closed');
      }

      toast.success(`Repayment of ${formatCurrency(paymentAmount)} recorded successfully!`);
      
      if (sendWhatsApp) {
        // Auto dispatch WhatsApp Payment Receipt
        const waMessage = generateWhatsAppMessageText(
          isClosed ? 'LOAN_CLOSURE' : 'REPAYMENT_RECEIPT',
          { loan, payment: newPayment }
        );
        sendWhatsAppAlert(loan.customer?.mobile_number, waMessage);
        toast.success(`Dispatched GST Receipt alert to ${loan.customer?.full_name || 'Customer'}`);
      }

      onClose();
      if (onSuccess) onSuccess();

      if (isClosed && onLoanClosed) {
        onLoanClosed({ ...loan, status: 'Closed' });
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to record repayment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-emerald-600">
            <div className="p-2 bg-emerald-100 rounded-xl text-emerald-800">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Record Loan Repayment</h3>
              <p className="text-[11px] text-slate-500 font-semibold">
                Contract #{loan.loan_number} • Borrower: {loan.customer?.full_name}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Loan Balance Quick Summary Card */}
        <div className="my-4 p-4 bg-slate-900 text-white rounded-2xl space-y-2 border border-slate-800 shadow-md">
          <div className="flex justify-between items-center text-xs text-slate-400 font-bold pb-2 border-b border-slate-800">
            <span>Pledged Gold: {loan.gold_item?.ornament_type || 'Gold Asset'} ({loan.gold_item?.net_weight} g)</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px]">
              {loan.status}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="bg-slate-800/80 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold">Principal Sanctioned</span>
              <strong className="text-sm font-extrabold text-white">{formatCurrency(loan.loan_amount)}</strong>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold">Accrued Interest</span>
              <strong className="text-sm font-extrabold text-amber-400">
                {formatCurrency(fin.netAccruedInterest)}
              </strong>
            </div>

            <div className="bg-slate-800/80 p-2 rounded-xl border border-emerald-500/30">
              <span className="text-[10px] text-slate-400 block font-semibold">Total Balance Due</span>
              <strong className="text-sm font-black text-emerald-400">{formatCurrency(fin.totalBalanceDue)}</strong>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); processRepayment(true); }} className="space-y-4">
          {fin.netAccruedInterest <= 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-900 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span>Notice: This loan contract currently has <strong>₹0 Accrued Interest</strong>. Interest repayment is disabled until interest accumulates over time.</span>
            </div>
          )}

          {/* Payment Type Options */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Repayment Purpose</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (fin.netAccruedInterest <= 0) {
                    toast.error('🚨 Interest Payment Restricted', {
                      description: 'This loan currently has ₹0 accrued interest. Select Part Principal or Full Settlement instead.',
                    });
                    return;
                  }
                  setPaymentType('Interest Payment');
                }}
                disabled={fin.netAccruedInterest <= 0}
                title={fin.netAccruedInterest <= 0 ? 'No accrued interest due on this loan' : 'Repay Interest Only'}
                className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                  fin.netAccruedInterest <= 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60'
                    : paymentType === 'Interest Payment'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-400'
                }`}
              >
                💵 Interest Only {fin.netAccruedInterest <= 0 && '(₹0 Due)'}
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
                📉 Part Principal
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
                🔒 Full Settlement
              </button>
            </div>
          </div>

          {/* Amount & Method Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Repayment Amount (₹) <span className="text-rose-500">*</span>
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
              <label className="block text-xs font-bold text-slate-700 mb-1">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="UPI">📱 UPI / QR Code</option>
                <option value="Cash">💵 Cash in Counter</option>
                <option value="Bank Transfer">🏦 Bank Transfer (IMPS/NEFT)</option>
                <option value="Cheque">📜 Cheque</option>
              </select>
            </div>
          </div>

          {/* Remarks Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Receipt Notes / Voucher # (Optional)</label>
            <input
              type="text"
              placeholder="e.g. GPay Ref #992810 / Cash received at counter"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Form Actions - Two Buttons: 1) Collect 2) Generate GST Receipt & Send */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>

            {/* Button 1: Collect Only */}
            <button
              type="button"
              disabled={loading}
              onClick={() => processRepayment(false)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950" />
              <span>{loading ? 'Processing...' : '1) Collect'}</span>
            </button>

            {/* Button 2: Generate GST Receipt & Send */}
            <button
              type="button"
              disabled={loading}
              onClick={() => processRepayment(true)}
              className="w-full sm:w-auto px-5 py-2.5 text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-4 h-4 text-emerald-100" />
              <span>{loading ? 'Generating...' : '2) Generate GST Receipt & Send'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
