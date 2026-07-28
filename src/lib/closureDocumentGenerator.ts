// ========================================================
// SuvarnaLoan ERP - Loan Closure Certificate & Document Generator
// Location: src/lib/closureDocumentGenerator.ts
// ========================================================

import { Loan, Shop } from '../types';
import { formatCurrency, formatDate, formatWeight } from './utils';
import { calculateLoanFinancials } from './goldValuationEngine';

export interface DocumentOptions {
  loan: Loan;
  shop?: Shop | null;
  closedBy?: string;
  closureDate?: string;
}

const DEFAULT_SHOP_INFO = {
  shop_name: 'Gold Loan Enterprise ERP',
  owner_name: 'Shop Owner',
  mobile: '+91 98765 43210',
  email: 'support@suvarnaloan.com',
  address: '108 Gold Bazaar, Zaveri Market, Mumbai - 400002',
  gstin: '27AAAAA0000A1Z5',
  license_number: 'GL-MUM-2024-884',
};

/**
 * Generates No Due Certificate HTML
 */
export function generateNoDueCertificateHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Rajesh Sharma (Owner)', closureDate = new Date().toISOString().split('T')[0] } = opts;
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || 'Borrower Customer';
  const certNo = `NDC-2026-${loan.id.replace(/\D/g, '').slice(-4) || '8841'}`;
  const verificationId = `VERIFY-NDC-${Math.floor(100000 + Math.random() * 900000)}`;

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>No Due Certificate - ${loan.loan_number}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.5; }
    .cert-border { border: 8px double #b45309; padding: 30px; border-radius: 12px; background: #fffdfa; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 25px; }
    .logo-title { font-size: 26px; font-weight: 900; color: #78350f; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
    .sub-address { font-size: 11px; color: #64748b; margin-top: 4px; }
    .badge-title { display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; padding: 8px 24px; border-radius: 20px; font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin: 20px 0 10px 0; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3); }
    .meta-row { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 25px; font-weight: 600; }
    .body-text { font-size: 13px; color: #1e293b; text-align: justify; margin-bottom: 25px; }
    .highlight-box { background: #fef3c7; border-left: 5px solid #d97706; padding: 15px 20px; border-radius: 8px; margin: 20px 0; font-size: 12px; }
    .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 25px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; }
    .info-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .info-val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .seal-box { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
    .green-seal { border: 3px solid #16a34a; color: #15803d; padding: 10px 18px; border-radius: 50px; font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; transform: rotate(-5deg); display: inline-block; }
    .signature-area { text-align: right; }
    .sig-line { width: 180px; border-bottom: 2px solid #0f172a; margin-left: auto; margin-bottom: 6px; }
    .footer { font-size: 9px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 10px; }
  </style>
</head>
<body>
  <div class="cert-border">
    <div class="header">
      <h1 class="logo-title">👑 ${s.shop_name}</h1>
      <div class="sub-address">${s.address} • GSTIN: ${s.gstin} • License: ${s.license_number}</div>
      <div><span class="badge-title">NO DUE CERTIFICATE</span></div>
    </div>

    <div class="meta-row">
      <span><strong>Certificate No:</strong> ${certNo}</span>
      <span><strong>Issue Date:</strong> ${formatDate(closureDate)}</span>
      <span><strong>Verification Code:</strong> ${verificationId}</span>
    </div>

    <div class="body-text">
      This is to certify that <strong>${customerName}</strong> (Mobile: ${loan.customer?.mobile_number || 'N/A'}) has fully repaid and settled the Gold Loan obtained under Contract Number <strong>${loan.loan_number}</strong> from <strong>${s.shop_name}</strong>.
    </div>

    <div class="highlight-box">
      <strong>✅ FULL SETTLEMENT ACKNOWLEDGEMENT:</strong><br/>
      All dues including the principal loan amount of <strong>${formatCurrency(loan.loan_amount)}</strong>, total interest of <strong>${formatCurrency(financials.totalInterestPaid)}</strong>, and applicable operational charges have been received in full. As of <strong>${formatDate(closureDate)}</strong>, there are no outstanding financial liabilities, interest charges, or penalties against this loan.
    </div>

    <div class="grid-info">
      <div class="info-card">
        <div class="info-label">Borrower Name</div>
        <div class="info-val">${customerName}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Loan Sanction Amount</div>
        <div class="info-val">${formatCurrency(loan.loan_amount)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Total Amount Paid</div>
        <div class="info-val">${formatCurrency(loan.loan_amount + financials.totalInterestPaid)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">Pledged Asset Status</div>
        <div class="info-val" style="color: #16a34a;">Handed Over to Customer</div>
      </div>
    </div>

    <div class="body-text">
      The pledged ornament assets (${loan.gold_item?.metal_type || 'Gold'} ${loan.gold_item?.ornament_type || 'Asset'}, ${formatWeight(loan.gold_item?.net_weight || 0)} net weight, Hallmark: ${loan.gold_item?.hallmark_number || 'HUID-Verified'}) have been physically inspected, verified, and returned to the customer in good condition.
    </div>

    <div class="seal-box">
      <div>
        <div class="green-seal">✔ NO DUES REMAINING • PAID IN FULL</div>
      </div>
      <div class="signature-area">
        <div class="sig-line"></div>
        <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${closedBy}</div>
        <div style="font-size: 10px; color: #64748b;">Authorized Signatory & Stamp</div>
      </div>
    </div>

    <div class="footer">
      This is an official computer-generated document issued under SuvarnaLoan ERP Protocol. Verification ID: ${verificationId}.
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates Loan Closure Certificate HTML
 */
export function generateClosureCertificateHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Rajesh Sharma (Owner)', closureDate = new Date().toISOString().split('T')[0] } = opts;
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || 'Borrower Customer';
  const certNo = `LCC-2026-${loan.id.replace(/\D/g, '').slice(-4) || '9012'}`;

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments
  );

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Loan Closure Certificate - ${loan.loan_number}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.4; }
    .container { border: 2px solid #e2e8f0; border-radius: 16px; padding: 30px; background: #ffffff; }
    .header-table { width: 100%; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #16a34a; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
    .section-head { font-size: 12px; font-weight: 800; color: #78350f; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0; border-bottom: 1px solid #fef3c7; padding-bottom: 4px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .lbl { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .status-badge { display: inline-block; background: #dcfce7; color: #15803d; border: 1px solid #86efac; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 800; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <table class="header-table">
      <tr>
        <td>
          <h1 class="title">🏆 ${s.shop_name}</h1>
          <div style="font-size: 11px; color: #64748b;">${s.address}</div>
        </td>
        <td style="text-align: right;">
          <div class="subtitle">Official Loan Closure Certificate</div>
          <div style="font-size: 11px; font-weight: 700; color: #475569;">${certNo}</div>
          <div style="font-size: 10px; color: #94a3b8;">Closed: ${formatDate(closureDate)}</div>
        </td>
      </tr>
    </table>

    <div class="section-head">1. Borrower & Contract Summary</div>
    <div class="grid-2">
      <div class="card"><div class="lbl">Borrower Customer</div><div class="val">${customerName}</div></div>
      <div class="card"><div class="lbl">Loan Account Number</div><div class="val">${loan.loan_number}</div></div>
      <div class="card"><div class="lbl">Disbursement Date</div><div class="val">${formatDate(loan.loan_date)}</div></div>
      <div class="card"><div class="lbl">Final Closure Date</div><div class="val">${formatDate(closureDate)}</div></div>
    </div>

    <div class="section-head">2. Financial Settlement Breakdown</div>
    <div class="grid-2">
      <div class="card"><div class="lbl">Sanctioned Principal Loan</div><div class="val">${formatCurrency(loan.loan_amount)}</div></div>
      <div class="card"><div class="lbl">Total Interest Earned & Paid</div><div class="val" style="color: #d97706;">${formatCurrency(financials.totalInterestPaid)}</div></div>
      <div class="card"><div class="lbl">Total Amount Collected</div><div class="val" style="color: #16a34a;">${formatCurrency(loan.loan_amount + financials.totalInterestPaid)}</div></div>
      <div class="card"><div class="lbl">Outstanding Balance Remaining</div><div class="val" style="color: #16a34a;">₹0.00 (Nil)</div></div>
    </div>

    <div class="section-head">3. Pledged Ornament Asset Audit</div>
    <div class="grid-2">
      <div class="card"><div class="lbl">Ornament Asset</div><div class="val">${loan.gold_item?.metal_type === 'Silver' ? '⚪ Silver' : '🟡 Gold'} ${loan.gold_item?.ornament_type || 'Item'} (${loan.gold_item?.purity || 'Standard Grade'})</div></div>
      <div class="card"><div class="lbl">Net Pure Weight</div><div class="val">${formatWeight(loan.gold_item?.net_weight || 0)}</div></div>
      <div class="card"><div class="lbl">Locker Packet #</div><div class="val">${loan.gold_item?.pocket_locker_number || 'LOCKER-A-01'}</div></div>
      <div class="card"><div class="lbl">Vault Release Status</div><div class="val" style="color: #16a34a;">Released & Returned</div></div>
    </div>

    <div class="footer">
      <div>
        <span class="status-badge">✔ LOAN CLOSED SUCCESSFULLY • PAID IN FULL</span>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${closedBy}</div>
        <div style="font-size: 10px; color: #64748b;">Authorized Branch Officer</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}


/**
 * Generates Official Repayment Receipt HTML
 */
export function generateRepaymentReceiptHTML(opts: DocumentOptions): string {
  const { loan, shop } = opts;
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || 'Borrower Customer';
  const receiptNo = `RCP-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments
  );

  const latestPayment = loan.payments && loan.payments.length > 0 ? loan.payments[loan.payments.length - 1] : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Repayment Receipt - ${loan.loan_number}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.4; }
    .container { border: 2px solid #cbd5e1; border-radius: 16px; padding: 25px; background: #ffffff; }
    .header { text-align: center; border-bottom: 2px solid #059669; padding-bottom: 15px; margin-bottom: 20px; }
    .title { font-size: 24px; font-weight: 900; color: #065f46; text-transform: uppercase; margin: 0; }
    .badge { display: inline-block; background: #d1fae5; color: #047857; padding: 4px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; margin-top: 8px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; }
    .lbl { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
    .table th, .table td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
    .table th { background: #f1f5f9; color: #475569; font-weight: 800; }
    .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">👑 ${s.shop_name}</h1>
      <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${s.address} • Contact: ${s.mobile}</div>
      <div><span class="badge">OFFICIAL REPAYMENT RECEIPT</span></div>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 15px; font-weight: 600;">
      <span><strong>Receipt No:</strong> ${receiptNo}</span>
      <span><strong>Date:</strong> ${formatDate(new Date().toISOString())}</span>
      <span><strong>Loan Account:</strong> ${loan.loan_number}</span>
    </div>

    <div class="grid-2">
      <div class="card"><div class="lbl">Customer Name</div><div class="val">${customerName}</div></div>
      <div class="card"><div class="lbl">Contact Mobile</div><div class="val">${loan.customer?.mobile_number || 'N/A'}</div></div>
      <div class="card"><div class="lbl">Sanction Principal</div><div class="val">${formatCurrency(loan.loan_amount)}</div></div>
      <div class="card"><div class="lbl">Pledged Asset</div><div class="val">${loan.gold_item?.metal_type === 'Silver' ? '⚪ Silver' : '🟡 Gold'} ${loan.gold_item?.ornament_type || 'Item'} (${formatWeight(loan.gold_item?.net_weight || 0)})</div></div>
    </div>

    <h3 style="font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; margin-bottom: 8px;">Recent Payment Received</h3>
    <div class="card" style="background: #ecfdf5; border-color: #a7f3d0; margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="lbl" style="color: #047857;">Amount Paid</div>
          <div style="font-size: 20px; font-weight: 900; color: #047857;">${latestPayment ? formatCurrency(latestPayment.amount) : formatCurrency(financials.totalInterestPaid)}</div>
        </div>
        <div style="text-align: right;">
          <div class="lbl">Payment Type / Mode</div>
          <div class="val">${latestPayment ? `${latestPayment.payment_type} (${latestPayment.payment_method})` : 'Interest Repayment'}</div>
          <div style="font-size: 10px; color: #64748b;">${latestPayment ? formatDate(latestPayment.payment_date) : formatDate(new Date().toISOString())}</div>
        </div>
      </div>
    </div>

    <h3 style="font-size: 12px; font-weight: 800; color: #1e293b; text-transform: uppercase; margin-bottom: 8px;">Updated Loan Account Balance</h3>
    <div class="grid-2">
      <div class="card"><div class="lbl">Total Interest Paid to Date</div><div class="val" style="color: #059669;">${formatCurrency(financials.totalInterestPaid)}</div></div>
      <div class="card"><div class="lbl">Remaining Principal Due</div><div class="val">${formatCurrency(financials.remainingPrincipal)}</div></div>
      <div class="card"><div class="lbl">Accrued Interest Pending</div><div class="val" style="color: #d97706;">${formatCurrency(financials.netAccruedInterest)}</div></div>
      <div class="card"><div class="lbl">Total Outstanding Payable</div><div class="val" style="color: #dc2626;">${formatCurrency(financials.totalBalanceDue)}</div></div>
    </div>

    <div class="footer">
      <div style="font-size: 10px; color: #64748b;">
        Thank you for your repayment.<br/>Computer generated receipt. Signature not mandatory.
      </div>
      <div style="text-align: right;">
        <div style="border-bottom: 1.5px solid #0f172a; width: 140px; margin-left: auto; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Authorized Cashier</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Triggers browser window print for generated HTML
 */
export function printHTMLDocument(htmlContent: string) {
  if (typeof window === 'undefined') return;
  const printWin = window.open('', '_blank', 'width=900,height=800');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(htmlContent);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  }
}

/**
 * Triggers direct browser file download of generated document
 */
export function downloadHTMLDocument(htmlContent: string, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.html') ? filename : `${filename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

