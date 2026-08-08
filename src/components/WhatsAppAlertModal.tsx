'use client';

// ========================================================
// SuvarnaLoan ERP - Interactive Customer WhatsApp Alert Dispatcher
// Supports English & Bank-Grade Marathi Localization
// Location: src/components/WhatsAppAlertModal.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  X,
  Copy,
  Calendar,
  Receipt,
  FileCheck,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Phone,
  Sparkles,
  Edit3,
} from 'lucide-react';
import { Loan, Payment } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { db } from '../lib/supabase/supabaseDb';
import {
  AlertType,
  generateWhatsAppMessageText,
  sendWhatsAppAlert,
  formatWhatsAppPhone,
} from '../lib/whatsappNotificationHelper';
import { toast } from 'sonner';
import { useTranslation } from '../providers/LanguageProvider';

interface WhatsAppAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
  payment?: Payment | null;
  defaultType?: AlertType;
}

export function WhatsAppAlertModal({
  isOpen,
  onClose,
  loan,
  payment,
  defaultType = 'MONTHLY_DUE',
}: WhatsAppAlertModalProps) {
  const { dict, language, isMarathi } = useTranslation();

  const [selectedType, setSelectedType] = useState<AlertType>(defaultType);
  const [messageBody, setMessageBody] = useState<string>('');
  const [customPhone, setCustomPhone] = useState<string>('');
  const [resolvedPayment, setResolvedPayment] = useState<Payment | null>(payment || null);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && loan) {
      setSelectedType(defaultType);
      setCustomPhone(loan.customer?.mobile_number || '');

      const syncLatestPaymentAndMessage = async () => {
        let activePmt = payment || null;
        if (!activePmt) {
          const existing = Array.isArray(loan.payments) ? loan.payments : [];
          if (existing.length > 0) {
            const sorted = [...existing].sort((a, b) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());
            activePmt = sorted[0];
          } else if (loan.shop_id) {
            try {
              const allPmts = await db.getPayments(loan.shop_id);
              const loanPmts = allPmts.filter(p => p.loan_id === loan.id || p.loan_id === loan.loan_number);
              if (loanPmts.length > 0) {
                const sorted = [...loanPmts].sort((a, b) => new Date(b.created_at || b.payment_date).getTime() - new Date(a.created_at || a.payment_date).getTime());
                activePmt = sorted[0];
              }
            } catch (err) {
              console.warn('WhatsAppAlertModal load payments warning:', err);
            }
          }
        }

        if (isMounted) {
          setResolvedPayment(activePmt);
          const text = generateWhatsAppMessageText(defaultType, { loan, payment: activePmt, language });
          setMessageBody(text);
        }
      };

      syncLatestPaymentAndMessage();
    }
    return () => { isMounted = false; };
  }, [isOpen, loan, payment, defaultType, language]);

  const handleTemplateChange = (type: AlertType) => {
    setSelectedType(type);
    if (!loan) return;
    const text = generateWhatsAppMessageText(type, { loan, payment: resolvedPayment, language });
    setMessageBody(text);
  };

  const handleSend = () => {
    if (!loan) return;
    const targetPhone = customPhone || loan.customer?.mobile_number;
    sendWhatsAppAlert(targetPhone, messageBody);
    toast.success(
      isMarathi
        ? `${loan.customer?.full_name || 'ग्राहकास'} व्हॉट्सॲप अलर्ट पाठवण्यात आला.`
        : `Opened WhatsApp alert for ${loan.customer?.full_name || 'Customer'}`
    );
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageBody);
    toast.success(isMarathi ? 'संदेश कॉपी झाला!' : 'Copied message text to clipboard!');
  };

  if (!isOpen || !loan) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center font-bold">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {dict.whatsapp.modalTitle}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {dict.loan.contractNumber}: {loan.loan_number} • {dict.customer.customerName}: {loan.customer?.full_name}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Template Selection Pills */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              {dict.whatsapp.templateType}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleTemplateChange('MONTHLY_DUE')}
                className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                  selectedType === 'MONTHLY_DUE'
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-400'
                }`}
              >
                📅 {dict.whatsapp.monthlyDue}
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('REPAYMENT_RECEIPT')}
                className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                  selectedType === 'REPAYMENT_RECEIPT'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-500'
                }`}
              >
                🧾 {dict.whatsapp.paymentReceipt}
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('LOAN_CLOSURE')}
                className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                  selectedType === 'LOAN_CLOSURE'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-amber-500'
                }`}
              >
                🎉 {dict.whatsapp.loanClosure}
              </button>

              <button
                type="button"
                onClick={() => handleTemplateChange('OVERDUE_ALERT')}
                className={`p-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                  selectedType === 'OVERDUE_ALERT'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-rose-400'
                }`}
              >
                ⚠️ {dict.whatsapp.overdueAlert}
              </button>
            </div>
          </div>

          {/* Customer Mobile Recipient */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{dict.customer.mobileNumber}:</span>
            </div>
            <input
              type="text"
              value={customPhone}
              onChange={(e) => setCustomPhone(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 text-right"
            />
          </div>

          {/* Message Preview and Editable Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <Edit3 className="w-3.5 h-3.5" />
                <span>{dict.whatsapp.previewMessage}</span>
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isMarathi ? 'मजकूर कॉपी करा' : 'Copy Text'}</span>
              </button>
            </div>

            <textarea
              rows={8}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full p-3 bg-slate-900 text-emerald-300 rounded-2xl font-mono text-xs leading-relaxed border border-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-inner"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              {dict.common.cancel}
            </button>

            <button
              type="button"
              onClick={handleSend}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>{dict.whatsapp.sendWhatsAppBtn}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
