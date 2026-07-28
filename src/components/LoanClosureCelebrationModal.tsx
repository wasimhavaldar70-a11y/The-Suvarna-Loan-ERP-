'use client';

// ========================================================
// SuvarnaLoan ERP - Loan Closure Celebration & Certificates Modal
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
  ArrowRight
} from 'lucide-react';
import { Loan } from '../types';
import { formatCurrency, formatDate, formatWeight } from '../lib/utils';
import { calculateLoanFinancials } from '../lib/goldValuationEngine';
import {
  generateNoDueCertificateHTML,
  generateClosureCertificateHTML,
  printHTMLDocument,
  downloadHTMLDocument
} from '../lib/closureDocumentGenerator';
import { toast } from 'sonner';

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
  const [closedBy] = useState('Rajesh Sharma (Owner)');
  const [closureDate] = useState(() => new Date().toISOString().split('T')[0]);

  if (!isOpen || !loan) return null;

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments
  );

  const handlePrintCertificate = (type: 'NDC' | 'LCC' | 'ALL') => {
    const opts = { loan, closedBy, closureDate };
    if (type === 'NDC') {
      const html = generateNoDueCertificateHTML(opts);
      printHTMLDocument(html);
      toast.success('Generated No Due Certificate for printing');
    } else if (type === 'LCC') {
      const html = generateClosureCertificateHTML(opts);
      printHTMLDocument(html);
      toast.success('Generated Loan Closure Certificate for printing');
    } else {
      const html1 = generateNoDueCertificateHTML(opts);
      const html2 = generateClosureCertificateHTML(opts);
      const combined = `${html1}<div style="page-break-before: always;"></div>${html2}`;
      printHTMLDocument(combined);
      toast.success('Generated all certificates for printing');
    }
  };

  const handleDownloadCertificate = (type: 'NDC' | 'LCC') => {
    const opts = { loan, closedBy, closureDate };
    if (type === 'NDC') {
      const html = generateNoDueCertificateHTML(opts);
      const filename = `No_Due_Certificate_${loan.loan_number}_${loan.customer?.full_name.replace(/\s+/g, '_')}.html`;
      downloadHTMLDocument(html, filename);
      toast.success(`Downloaded ${filename}`);
    } else {
      const html = generateClosureCertificateHTML(opts);
      const filename = `Loan_Closure_Certificate_${loan.loan_number}_${loan.customer?.full_name.replace(/\s+/g, '_')}.html`;
      downloadHTMLDocument(html, filename);
      toast.success(`Downloaded ${filename}`);
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `Dear ${loan.customer?.full_name || 'Customer'},\n\nYour Gold Loan *${loan.loan_number}* at Suvarna Gold Jewellers has been successfully closed. Thank you for your timely repayments!\n\nNo Due Certificate and Gold Release Receipt are generated.\n\nRegards,\nSuvarnaLoan ERP`
    );
    window.open(`https://api.whatsapp.com/send?phone=${loan.customer?.mobile_number || ''}&text=${text}`, '_blank');
    toast.success('Opened WhatsApp certificate alert');
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: 'spring', stiffness: 220, damping: 20 }}
          className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-2xl w-full p-6 md:p-8 shadow-2xl backdrop-blur-xl text-white my-auto overflow-hidden relative"
        >
          {/* Top Floating Glow Effect */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-br from-amber-500/30 to-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-full transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header Celebration Graphic */}
          <div className="text-center pb-6 border-b border-slate-800 relative z-10">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 border-4 border-amber-200/50 relative"
            >
              <Award className="w-11 h-11" />
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.8 }}
                className="absolute inset-0 rounded-3xl bg-amber-400 blur-md -z-10"
              />
            </motion.div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
              <span>🎉 Congratulations!</span>
              <Sparkles className="w-6 h-6 text-amber-400 animate-pulse" />
            </h2>

            <p className="text-xs md:text-sm text-emerald-400 font-extrabold mt-1 max-w-md mx-auto">
              Gold Loan Account Closed Successfully! All dues paid in full.
            </p>
          </div>

          {/* Glassmorphism Summary Card */}
          <div className="my-6 p-4 bg-slate-800/80 border border-slate-700/80 rounded-2xl space-y-3 backdrop-blur-md relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Borrower Customer</span>
              <span className="text-xs font-extrabold text-white">{loan.customer?.full_name || 'Borrower'}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Loan Contract Number</span>
              <span className="text-xs font-mono font-bold text-amber-400">{loan.loan_number}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Pledged Gold Asset</span>
              <span className="text-xs font-bold text-amber-300">
                {loan.gold_item?.ornament_type || 'Gold Item'} ({formatWeight(loan.gold_item?.net_weight || 0)})
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Total Sanction Loan</span>
              <span className="text-xs font-bold text-slate-200">{formatCurrency(loan.loan_amount)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400">Total Interest Earned</span>
              <span className="text-xs font-bold text-amber-400">{formatCurrency(financials.totalInterestPaid)}</span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
              <span className="text-xs font-bold text-slate-400">Account Status</span>
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider">
                ✔ CLOSED (Paid in Full)
              </span>
            </div>
          </div>

          {/* Certificate Generation & Download Action Buttons */}
          <div className="space-y-3 relative z-10">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Auto-Generated Official Certificates & Downloads:
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* No Due Certificate Card with Print & Download */}
              <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    <FileCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-extrabold">No Due Certificate</div>
                    <div className="text-[10px] text-slate-400 font-normal">Official Bank Grade</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadCertificate('NDC')}
                    title="Download Certificate"
                    className="p-2 bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 rounded-xl transition-colors flex items-center gap-1 font-bold text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintCertificate('NDC')}
                    title="Print Certificate"
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Loan Closure Certificate Card with Print & Download */}
              <div className="p-3.5 bg-slate-800/90 border border-slate-700 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-white font-extrabold">Closure Certificate</div>
                    <div className="text-[10px] text-slate-400 font-normal">Paid in Full Seal</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleDownloadCertificate('LCC')}
                    title="Download Certificate"
                    className="p-2 bg-amber-500/20 hover:bg-amber-500/40 text-amber-300 rounded-xl transition-colors flex items-center gap-1 font-bold text-[11px]"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintCertificate('LCC')}
                    title="Print Certificate"
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
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
                <span>Print All Certificates</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareWhatsApp}
                  className="px-3.5 py-2.5 bg-emerald-600/90 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>WhatsApp Alert</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
