// ========================================================
// SuvarnaLoan ERP - WhatsApp Notification & Customer Alert Engine
// Location: src/lib/whatsappNotificationHelper.ts
// ========================================================

import { Loan, Payment, Shop } from '../types';
import { formatCurrency, formatDate, formatWeight } from './utils';
import { calculateLoanFinancials } from './goldValuationEngine';

const DEFAULT_SHOP_NAME = 'Jewellery Loan Enterprise';

export type AlertType = 
  | 'MONTHLY_DUE'
  | 'REPAYMENT_RECEIPT'
  | 'LOAN_CLOSURE'
  | 'OVERDUE_ALERT'
  | 'GOLD_RELEASE'
  | 'CUSTOM';

export interface WhatsAppAlertOptions {
  loan: Loan;
  payment?: Payment | null;
  shopName?: string;
  customMessage?: string;
}

/**
 * Clean & Format phone number for WhatsApp Web API (e.g. +91 98765 43210 -> 919876543210)
 */
export function formatWhatsAppPhone(phone: string | undefined | null): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Generate formatted message text for various WhatsApp alert templates
 */
export function generateWhatsAppMessageText(type: AlertType, opts: WhatsAppAlertOptions): string {
  const { loan, payment, shopName = DEFAULT_SHOP_NAME, customMessage } = opts;

  // Normalize customer name
  const rawCust = Array.isArray(loan.customer) ? loan.customer[0] : loan.customer;
  const customerName = rawCust?.full_name || rawCust?.name || 'Valued Customer';

  // Ensure active/new payment is included in financial calculations
  const existingPayments = Array.isArray(loan.payments) ? loan.payments : [];

  // Sort payments to get the latest 1 repayment (most recent date/created_at first)
  const sortedPayments = [...existingPayments].sort((a, b) => {
    const tA = new Date(a.created_at || a.payment_date).getTime();
    const tB = new Date(b.created_at || b.payment_date).getTime();
    return tB - tA;
  });

  const activePayment = payment || (sortedPayments.length > 0 ? sortedPayments[0] : null);

  const hasActivePayment = activePayment && existingPayments.some(
    p => (p.id && p.id === activePayment.id) || (p.created_at && p.created_at === activePayment.created_at)
  );

  const effectivePayments = (activePayment && !hasActivePayment)
    ? [activePayment, ...existingPayments]
    : existingPayments;

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    effectivePayments,
    loan.repayment_model || 'Bullet Repayment',
    loan.tenure_months || 12
  );

  const ornament = loan.gold_item?.ornament_type || 'Pledged Gold Asset';
  const weight = formatWeight(loan.gold_item?.net_weight || 0);

  switch (type) {
    case 'MONTHLY_DUE': {
      return (
        `*📢 MONTHLY INTEREST & DUE REMINDER*\n` +
        `*${shopName}*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `This is a gentle reminder regarding your Gold Loan account:\n\n` +
        `🔹 *Loan Contract #:* ${loan.loan_number}\n` +
        `🔹 *Pledged Gold:* ${ornament} (${weight})\n` +
        `🔹 *Sanction Principal:* ${formatCurrency(loan.loan_amount)}\n` +
        `🔹 *Monthly Rate:* ${loan.interest_rate}%\n` +
        `🔸 *Accrued Interest Due:* ${formatCurrency(financials.netAccruedInterest)}\n` +
        `🔸 *Total Balance Payable:* ${formatCurrency(financials.totalBalanceDue)}\n` +
        `📅 *Due Date:* ${formatDate(loan.due_date)}\n\n` +
        `Kindly pay your monthly interest to maintain your credit score and avoid overdue charges.\n\n` +
        `For queries, visit our shop or reply to this message.\n` +
        `Thank you for your partnership! 🙏`
      );
    }

    case 'REPAYMENT_RECEIPT': {
      const pAmt = activePayment ? formatCurrency(activePayment.amount) : formatCurrency(financials.totalInterestPaid);
      const pType = activePayment ? activePayment.payment_type : 'Repayment';
      const pDate = activePayment ? formatDate(activePayment.payment_date) : formatDate(new Date().toISOString());
      const pMethod = activePayment ? activePayment.payment_method : 'Cash / UPI';
      const rawNotes = activePayment?.notes?.trim() || '';
      const pNotes = rawNotes.includes('recorded via') ? '' : rawNotes;

      return (
        `*✅ PAYMENT RECEIPT CONFIRMATION*\n` +
        `*${shopName}*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `Thank you! We have successfully received your repayment:\n\n` +
        `🔹 *Loan Contract #:* ${loan.loan_number}\n` +
        `💵 *Amount Received:* ${pAmt}\n` +
        `📝 *Payment Type:* ${pType}\n` +
        `💳 *Mode:* ${pMethod}\n` +
        (pNotes ? `📌 *Payment Notes:* ${pNotes}\n` : '') +
        `📅 *Receipt Date:* ${pDate}\n\n` +
        `📊 *UPDATED ACCOUNT STATUS:*\n` +
        `▫️ *Remaining Principal:* ${formatCurrency(financials.remainingPrincipal)}\n` +
        `▫️ *Total Outstanding Balance:* ${formatCurrency(financials.totalBalanceDue)}\n\n` +
        `Your updated digital ledger statement is recorded in our system.\n` +
        `Thank you for your timely repayment! 🙏`
      );
    }

    case 'LOAN_CLOSURE': {
      const rawNotes = activePayment?.notes?.trim() || '';
      const pNotes = rawNotes.includes('recorded via') ? '' : rawNotes;
      return (
        `*🎉 GOLD LOAN CLOSURE & NO DUE CERTIFICATE*\n` +
        `*${shopName}*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `Congratulations! Your Gold Loan contract *${loan.loan_number}* has been *FULLY CLOSED* and settled.\n\n` +
        `🏆 *CLOSURE DETAILS:*\n` +
        `▫️ *Sanction Loan:* ${formatCurrency(loan.loan_amount)}\n` +
        `▫️ *Total Interest Paid:* ${formatCurrency(financials.totalInterestPaid)}\n` +
        `▫️ *Outstanding Dues:* ₹0.00 (PAID IN FULL)\n` +
        `▫️ *Pledged Ornament:* ${ornament} (${weight})\n` +
        (pNotes ? `📌 *Payment Notes:* ${pNotes}\n` : '') +
        `\n` +
        `📄 Your *No Due Certificate* and *Gold Asset Release Receipt* have been generated and issued.\n` +
        `Please collect your gold ornament from our vault locker.\n\n` +
        `Thank you for trusting *${shopName}*! We look forward to serving you again. 🌟`
      );
    }

    case 'OVERDUE_ALERT': {
      return (
        `*⚠️ URGENT OVERDUE PAYMENT ALERT*\n` +
        `*${shopName}*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `Your Gold Loan account *${loan.loan_number}* is currently *OVERDUE* by ${financials.overdueDays} days.\n\n` +
        `🚨 *OVERDUE SUMMARY:*\n` +
        `▫️ *Accrued Interest Due:* ${formatCurrency(financials.netAccruedInterest)}\n` +
        `▫️ *Total Balance Payable:* ${formatCurrency(financials.totalBalanceDue)}\n` +
        `▫️ *Pledged Gold Asset:* ${ornament} (${weight})\n\n` +
        `Please clear your interest dues immediately to prevent default action or statutory penalty interest.\n\n` +
        `Contact us immediately to arrange payment.\n` +
        `Regards,\n*${shopName}*`
      );
    }

    case 'GOLD_RELEASE': {
      return (
        `*🔐 PLEDGED GOLD ASSET RELEASE NOTICE*\n` +
        `*${shopName}*\n\n` +
        `Dear *${customerName}*,\n\n` +
        `Your pledged gold asset for Loan *${loan.loan_number}* is ready for pickup from our secure vault.\n\n` +
        `📦 *ASSET DETAILS:*\n` +
        `▫️ *Ornament:* ${ornament}\n` +
        `▫️ *Net Pure Weight:* ${weight}\n` +
        `▫️ *Condition:* Inspected & Verified\n\n` +
        `Please bring your original ID proof and receipt to collect your ornament.\n` +
        `Thank you! 🙏`
      );
    }

    case 'CUSTOM':
    default: {
      return customMessage || (
        `Hello *${customerName}*,\n\n` +
        `This is a message from *${shopName}* regarding your Gold Loan account *${loan.loan_number}*.\n\n` +
        `Current Outstanding Balance: ${formatCurrency(financials.totalBalanceDue)}\n` +
        `Thank you!`
      );
    }
  }
}

/**
 * Open WhatsApp Web or App link directly with pre-formatted message text
 */
export function sendWhatsAppAlert(phone: string | undefined | null, messageText: string) {
  const cleanPhone = formatWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(messageText);
  
  if (!cleanPhone) {
    window.open(`https://api.whatsapp.com/send?text=${encodedText}`, '_blank');
    return;
  }
  
  window.open(`https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`, '_blank');
}
