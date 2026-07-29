'use client';

// ========================================================
// SuvarnaLoan ERP - Interactive Customer WhatsApp Alert Dispatcher
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
  Edit3
} from 'lucide-react';
import { Loan, Payment } from '../types';
import { formatCurrency, formatDate } from '../lib/utils';
import { db } from '../lib/supabase/supabaseDb';
import {
  AlertType,
  generateWhatsAppMessageText,
  sendWhatsAppAlert,
  formatWhatsAppPhone
} from '../lib/whatsappNotificationHelper';
import { toast } from 'sonner';

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
          const text = generateWhatsAppMessageText(defaultType, { loan, payment: activePmt });
          setMessageBody(text);
        }
      };

      syncLatestPaymentAndMessage();
    }
    return () => { isMounted = false; };
  }, [isOpen, loan, payment, defaultType]);

  const handleTemplateChange = (type: AlertType) => {
    setSelectedType(type);
    if (!loan) return;
    const text = generateWhatsAppMessageText(type, { loan, payment: resolvedPayment });
    setMessageBody(text);
  };

  const handleSend = () => {
    if (!loan) return;
    sendWhatsAppAlert(customPhone || loan.customer?.mobile_number, messageBody);
    toast.success('Dispatched WhatsApp alert to customer');
    onClose();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(messageBody);
    toast.success('Copied WhatsApp message text to clipboard');
  };

  if (!isOpen || !loan) return null;

  const templates: { type: AlertType; label: string; icon: any; color: string }[] = [
    { type: 'MONTHLY_DUE', label: 'Monthly Due & Interest', icon: Calendar, color: 'text-amber-600 bg-amber-50 border-amber-200' },
    { type: 'REPAYMENT_RECEIPT', label: 'Payment Receipt', icon: Receipt, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { type: 'LOAN_CLOSURE', label: 'Loan Closure Cert.', icon: FileCheck, color: 'text-sky-600 bg-sky-50 border-sky-200' },
    { type: 'OVERDUE_ALERT', label: 'Overdue Reminder', icon: AlertTriangle, color: 'text-rose-600 bg-rose-50 border-rose-200' },
    { type: 'GOLD_RELEASE', label: 'Pledged Gold Release', icon: Lock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl max-w-xl w-full p-6 md:p-8 shadow-2xl border border-slate-200 relative my-auto"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md shadow-emerald-500/20">
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>Send WhatsApp Customer Alert</span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Direct customer messaging for interest due, receipts & certificates
              </p>
            </div>
          </div>

          {/* Customer & Mobile Number Bar */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3 text-xs mb-5">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="font-bold text-slate-900">{loan.customer?.full_name || 'Customer'}</span>
                <span className="text-slate-400 ml-1">({loan.loan_number})</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Mobile:</span>
              <input
                type="text"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                placeholder="+91 Mobile #"
                className="px-2.5 py-1 text-xs font-mono font-bold border border-slate-300 rounded-lg w-32 focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>
          </div>

          {/* Template Selectors Grid */}
          <div className="space-y-2 mb-4">
            <div className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
              Select Message Template:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {templates.map((tpl) => {
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

          {/* Editable Live WhatsApp Text Preview */}
          <div className="space-y-1.5 mb-6">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Edit3 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Message Body Preview (Editable):</span>
              </span>
              <span className="text-slate-400 text-[10px]">WhatsApp Markdown Enabled</span>
            </div>

            <textarea
              rows={8}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full p-3 text-xs font-mono bg-slate-900 text-slate-100 border border-slate-800 rounded-2xl focus:outline-none focus:border-emerald-500 leading-relaxed shadow-inner"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCopy}
              className="px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy Text</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSend}
                className="px-5 py-2.5 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-transform active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Send WhatsApp Alert</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
