'use client';

// ========================================================
// SuvarnaLoan ERP - Loan Closure Celebration & Certificates Modal
// Supports English & Bank-Grade Marathi Localization
// Location: src/components/LoanClosureCelebrationModal.tsx
// ========================================================

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  X,
  Printer,
  Download,
  Share2,
  Award,
  Sparkles,
  ShieldCheck,
  FileCheck,
  FileText,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { Loan } from '../types';
import { formatCurrency, formatDate, formatWeight } from '../lib/utils';
import { calculateLoanFinancials } from '../lib/goldValuationEngine';
import {
  generateNoDueCertificateHTML,
  generateClosureCertificateHTML,
  printHTMLDocument,
} from '../lib/closureDocumentGenerator';
import { toast } from 'sonner';
import { useTranslation } from '../providers/LanguageProvider';

interface LoanClosureCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: Loan | null;
}

export function LoanClosureCelebrationModal({
  isOpen,
  onClose,
  loan,
}: LoanClosureCelebrationModalProps) {
  const { dict, language, isMarathi } = useTranslation();
  const [closedBy] = useState('Authorized Officer');
  const [closureDate] = useState(() => new Date().toISOString().split('T')[0]);

  if (!isOpen || !loan) return null;

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments,
    loan.repayment_model || 'Bullet Repayment',
    loan.tenure_months || 12,
    loan.disbursements || []
  );

  const handlePrintCertificate = (type: 'NDC' | 'LCC' | 'ALL') => {
    const opts = { loan, closedBy, closureDate, language };
    if (type === 'NDC') {
      const html = generateNoDueCertificateHTML(opts);
      printHTMLDocument(html);
      toast.success(isMarathi ? 'निरंक दाखला मुद्रित करण्यासाठी तयार केला' : 'Generated No Due Certificate for printing');
    } else if (type === 'LCC') {
      const html = generateClosureCertificateHTML(opts);
      printHTMLDocument(html);
      toast.success(isMarathi ? 'कर्ज समाप्ती प्रमाणपत्र मुद्रित करण्यासाठी तयार केले' : 'Generated Loan Closure Certificate for printing');
    } else {
      const html1 = generateNoDueCertificateHTML(opts);
      const html2 = generateClosureCertificateHTML(opts);
      const combined = `${html1}<div style="page-break-before: always;"></div>${html2}`;
      printHTMLDocument(combined);
      toast.success(isMarathi ? 'सर्व दाखले मुद्रित करण्यासाठी तयार केले' : 'Generated all certificates for printing');
    }
  };

  const handleShareWhatsApp = () => {
    const text = isMarathi
      ? encodeURIComponent(
          `आदरणीय ${loan.customer?.full_name || 'ग्राहक'},\n\nआपले सुवर्ण कर्ज खाते *${loan.loan_number}* पूर्णपणे भरणा होऊन यशस्वीरित्या बंद झाले आहे. वेळेवर भरणा केल्याबद्दल धन्यवाद!\n\nआपला निरंक दाखला (No Due Certificate) व तारण दागिने सुपूर्द पावती तयार आहे.\n\nधन्यवाद,\nSuvarnaLoan ERP`
        )
      : encodeURIComponent(
          `Dear ${loan.customer?.full_name || 'Customer'},\n\nYour Gold Loan *${loan.loan_number}* has been successfully closed. Thank you for your timely repayments!\n\nNo Due Certificate and Gold Release Receipt are generated.\n\nRegards,\nSuvarnaLoan ERP`
        );
    window.open(`https://api.whatsapp.com/send?phone=${loan.customer?.mobile_number || ''}&text=${text}`, '_blank');
    toast.success(isMarathi ? 'व्हॉट्सॲप मेसेज विंडो उघडली' : 'Opened WhatsApp certificate alert');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto font-sans">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border-2 border-amber-500/50 rounded-3xl max-w-xl w-full p-6 text-white shadow-2xl relative overflow-hidden my-8"
        >
          {/* Ambient Gold Glow Background */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Celebration Header */}
          <div className="text-center space-y-2 relative z-10">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-amber-300 mx-auto flex items-center justify-center text-slate-950 shadow-xl gold-glow animate-bounce">
              <Sparkles className="w-8 h-8" />
            </div>

            <h2 className="text-xl md:text-2xl font-black tracking-tight text-white">
              {dict.closure.title}
            </h2>
            <p className="text-xs text-amber-300/90 font-medium">
              {dict.closure.allDuesCleared}
            </p>
          </div>

          {/* Settlement Details Grid */}
          <div className="my-6 p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-3 backdrop-blur-md relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{dict.loan.borrowerName}</span>
              <span className="text-xs font-extrabold text-white">{loan.customer?.full_name || 'Borrower'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{dict.loan.contractNumber}</span>
              <span className="text-xs font-mono font-bold text-amber-400">{loan.loan_number}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{dict.goldItem.ornamentType}</span>
              <span className="text-xs font-bold text-amber-300">
                {loan.gold_item?.ornament_type || 'Gold Item'} ({formatWeight(loan.gold_item?.net_weight || 0)})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{dict.loan.loanAmount}</span>
              <span className="text-xs font-bold text-slate-200">{formatCurrency(financials.totalDisbursed || loan.loan_amount)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">{isMarathi ? 'एकूण भरलेले व्याज' : 'Total Interest Earned'}</span>
              <span className="text-xs font-bold text-amber-400">{formatCurrency(financials.totalInterestPaid)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
              <span className="text-xs font-bold text-slate-400">{dict.common.status}</span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider">
                ✔ {isMarathi ? 'बंद (पूर्ण परतफेड)' : 'CLOSED (Paid in Full)'}
              </span>
            </div>
          </div>

          {/* Certificate Generation & Action Buttons */}
          <div className="space-y-3 relative z-10">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {isMarathi ? 'अधिकृत प्रमाणपत्रे व पावत्या:' : 'Auto-Generated Official Certificates & Downloads:'}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* No Due Certificate Card */}
              <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-extrabold">{dict.closure.noDueCertificate}</div>
                    <div className="text-[10px] text-slate-400 font-normal">Official Bank Grade</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePrintCertificate('NDC')}
                    title={dict.common.print}
                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-xl transition-colors flex items-center gap-1 font-bold text-[11px]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{dict.common.print}</span>
                  </button>
                </div>
              </div>

              {/* Gold Release Receipt Card */}
              <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-extrabold">{dict.closure.goldReleaseVoucher}</div>
                    <div className="text-[10px] text-slate-400 font-normal">Vault Release Seal</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePrintCertificate('LCC')}
                    title={dict.common.print}
                    className="p-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-xl transition-colors flex items-center gap-1 font-bold text-[11px]"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>{dict.common.print}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handlePrintCertificate('ALL')}
                className="px-4 py-2.5 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:to-amber-800 text-slate-950 rounded-xl font-black text-xs shadow-lg gold-glow flex items-center gap-2 transition-transform active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>{isMarathi ? 'सर्व दाखले मुद्रित करा' : 'Print All Certificates'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>{dict.nav.whatsapp}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs"
                >
                  {dict.common.close}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
