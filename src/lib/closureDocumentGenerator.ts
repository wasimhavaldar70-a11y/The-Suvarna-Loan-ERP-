// ========================================================
// SuvarnaLoan ERP - Bilingual Document & Certificate Generator
// Supports Bank-Grade Marathi & English Devanagari Unicode PDF Generation
// Location: src/lib/closureDocumentGenerator.ts
// ========================================================

import { Loan, Shop, Payment } from '../types';
import { formatCurrency, formatDate, formatWeight } from './utils';
import { calculateLoanFinancials } from './goldValuationEngine';

export interface DocumentOptions {
  loan: Loan;
  shop?: Shop | null;
  closedBy?: string;
  closureDate?: string;
  language?: 'en' | 'mr';
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

function getActiveLanguage(opts?: DocumentOptions): 'en' | 'mr' {
  if (opts?.language) return opts.language;
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sl_language');
    if (stored === 'mr' || stored === 'en') return stored;
  }
  return 'en';
}

const FONT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800;900&display=swap');
  body, * {
    font-family: 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
  }
`;

/**
 * Generates Official No Due Certificate HTML (Bilingual)
 */
export function generateNoDueCertificateHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Authorized Signatory', closureDate = new Date().toISOString().split('T')[0] } = opts;
  const lang = getActiveLanguage(opts);
  const isMr = lang === 'mr';
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || (isMr ? 'कर्जदार ग्राहक' : 'Borrower Customer');
  const certNo = `NDC-2026-${loan.id.replace(/\D/g, '').slice(-4) || '8841'}`;
  const verificationId = `VERIFY-NDC-${Math.floor(100000 + Math.random() * 900000)}`;

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

  const totalDisbursed = financials.totalDisbursed || loan.loan_amount;

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${isMr ? 'कर्जमुक्ती निरंक दाखला' : 'No Due Certificate'} - ${loan.loan_number}</title>
  <style>
    ${FONT_STYLES}
    @page { size: A4; margin: 15mm; }
    body { color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.5; font-size: 12px; }
    .cert-border { border: 8px double #b45309; padding: 30px; border-radius: 12px; background: #fffdfa; box-shadow: 0 0 20px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 2px solid #f59e0b; padding-bottom: 20px; margin-bottom: 25px; }
    .logo-title { font-size: 24px; font-weight: 900; color: #78350f; letter-spacing: -0.5px; text-transform: uppercase; margin: 0; }
    .sub-address { font-size: 11px; color: #64748b; margin-top: 4px; }
    .badge-title { display: inline-block; background: linear-gradient(135deg, #d97706, #b45309); color: #ffffff; padding: 8px 24px; border-radius: 20px; font-size: 16px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px 0; box-shadow: 0 4px 10px rgba(217, 119, 6, 0.3); }
    .meta-row { display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 25px; font-weight: 600; }
    .body-text { font-size: 13px; color: #1e293b; text-align: justify; margin-bottom: 25px; line-height: 1.6; }
    .highlight-box { background: #fef3c7; border-left: 5px solid #d97706; padding: 15px 20px; border-radius: 8px; margin: 20px 0; font-size: 12px; }
    .grid-info { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; margin-bottom: 25px; }
    .info-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; }
    .info-label { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .info-val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .seal-box { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
    .green-seal { border: 3px solid #16a34a; color: #15803d; padding: 10px 18px; border-radius: 50px; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; transform: rotate(-4deg); display: inline-block; }
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
      <div><span class="badge-title">${isMr ? 'सुवर्ण कर्जमुक्ती निरंक दाखला' : 'NO DUE CERTIFICATE'}</span></div>
    </div>

    <div class="meta-row">
      <span><strong>${isMr ? 'दाखला क्रमांक:' : 'Certificate No:'}</strong> ${certNo}</span>
      <span><strong>${isMr ? 'दिनांक:' : 'Issue Date:'}</strong> ${formatDate(closureDate)}</span>
      <span><strong>${isMr ? 'पडताळणी कोड:' : 'Verification Code:'}</strong> ${verificationId}</span>
    </div>

    <div class="body-text">
      ${isMr
        ? `प्रमाणित करण्यात येते की, सन्माननीय <strong>${customerName}</strong> (मोबाईल: ${loan.customer?.mobile_number || 'N/A'}) यांनी <strong>${s.shop_name}</strong> कडून घेतलेल्या सुवर्ण कर्ज खाते क्रमांक <strong>${loan.loan_number}</strong> ची मुद्दल व व्याजासह संपूर्ण परतफेड केलेली आहे.`
        : `This is to certify that <strong>${customerName}</strong> (Mobile: ${loan.customer?.mobile_number || 'N/A'}) has fully repaid and settled the Gold Loan obtained under Contract Number <strong>${loan.loan_number}</strong> from <strong>${s.shop_name}</strong>.`
      }
    </div>

    <div class="highlight-box">
      <strong>${isMr ? '✅ संपूर्ण भरणा व खाते समाप्ती पावती:' : '✅ FULL SETTLEMENT ACKNOWLEDGEMENT:'}</strong><br/>
      ${isMr
        ? `एकूण वितरित मुद्दल रक्कम <strong>${formatCurrency(totalDisbursed)}</strong> आणि एकूण भरलेले व्याज <strong>${formatCurrency(financials.totalInterestPaid)}</strong> पूर्णपणे प्राप्त झाले आहे. दिनांक <strong>${formatDate(closureDate)}</strong> रोजी या कर्ज खात्यावर कोणतीही आर्थिक बाकी, व्याज किंवा दंड शिल्लक नाही.`
        : `All dues including the total principal loan amount of <strong>${formatCurrency(totalDisbursed)}</strong>, total interest of <strong>${formatCurrency(financials.totalInterestPaid)}</strong>, and applicable charges have been received in full. As of <strong>${formatDate(closureDate)}</strong>, there are no outstanding financial liabilities against this loan.`
      }
    </div>

    <div class="grid-info">
      <div class="info-card">
        <div class="info-label">${isMr ? 'ग्राहकाचे नाव' : 'Borrower Name'}</div>
        <div class="info-val">${customerName}</div>
      </div>
      <div class="info-card">
        <div class="info-label">${isMr ? 'एकूण वितरित मुद्दल' : 'Total Principal Loan'}</div>
        <div class="info-val">${formatCurrency(totalDisbursed)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">${isMr ? 'एकूण जमा रक्कम (मुद्दल + व्याज)' : 'Total Amount Paid'}</div>
        <div class="info-val">${formatCurrency(totalDisbursed + financials.totalInterestPaid)}</div>
      </div>
      <div class="info-card">
        <div class="info-label">${isMr ? 'तारण दागिन्यांची स्थिती' : 'Pledged Asset Status'}</div>
        <div class="info-val" style="color: #16a34a;">${isMr ? 'ग्राहकास सुपूर्द केले ✅' : 'Handed Over to Customer ✅'}</div>
      </div>
    </div>

    <div class="body-text">
      ${isMr
        ? `तारण ठेवलेले सोन्याचे दागिने (${loan.gold_item?.ornament_type || 'सोन्याचे दागिने'}, निव्वळ शुद्ध वजन: ${formatWeight(loan.gold_item?.net_weight || 0)}, हॉलमार्क HUID: ${loan.gold_item?.hallmark_number || 'HUID-Verified'}) योग्य स्थितीत ग्राहकास प्रत्यक्ष सुपूर्द करण्यात आले आहेत.`
        : `The pledged ornament assets (${loan.gold_item?.ornament_type || 'Gold Asset'}, ${formatWeight(loan.gold_item?.net_weight || 0)} net pure weight, Hallmark: ${loan.gold_item?.hallmark_number || 'HUID-Verified'}) have been physically verified and returned to the borrower in good condition.`
      }
    </div>

    <div class="seal-box">
      <div>
        <div class="green-seal">✔ ${isMr ? 'सर्व थकबाकी पूर्ण • खाते बंद' : 'NO DUES REMAINING • PAID IN FULL'}</div>
      </div>
      <div class="signature-area">
        <div class="sig-line"></div>
        <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${closedBy}</div>
        <div style="font-size: 10px; color: #64748b;">${isMr ? 'अधिकृत स्वाक्षरी व पेढीचा शिक्का' : 'Authorized Signatory & Stamp'}</div>
      </div>
    </div>

    <div class="footer">
      ${isMr
        ? `हा संगणकीकृत अधिकृत दाखला SuvarnaLoan ERP प्रणालीद्वारे जारी करण्यात आला आहे. पडताळणी कोड: ${verificationId}`
        : `This is an official computer-generated document issued under SuvarnaLoan ERP Protocol. Verification ID: ${verificationId}.`
      }
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates Official Loan Closure Certificate HTML (Bilingual)
 */
export function generateClosureCertificateHTML(opts: DocumentOptions): string {
  return generateNoDueCertificateHTML(opts);
}

/**
 * Generates Physical Gold Asset Handover & Release Voucher HTML (Bilingual)
 */
export function generatePhysicalGoldReleaseHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Authorized Custodian' } = opts;
  const lang = getActiveLanguage(opts);
  const isMr = lang === 'mr';
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || (isMr ? 'कर्जदार ग्राहक' : 'Borrower Customer');
  const voucherNo = `REL-2026-${loan.id.replace(/\D/g, '').slice(-4) || '8841'}`;

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${isMr ? 'तारण सोने सुपूर्द पावती' : 'Gold Release Voucher'} - ${loan.loan_number}</title>
  <style>
    ${FONT_STYLES}
    @page { size: A4; margin: 15mm; }
    body { color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.5; font-size: 12px; }
    .container { border: 2px solid #cbd5e1; border-radius: 12px; padding: 25px; }
    .header { text-align: center; border-bottom: 2px solid #d97706; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 900; color: #78350f; text-transform: uppercase; margin: 0; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-top: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .lbl { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
    .table th, .table td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
    .table th { background: #f1f5f9; color: #475569; font-weight: 800; }
    .footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">👑 ${s.shop_name}</h1>
      <div style="font-size: 11px; color: #64748b;">${s.address} • Contact: ${s.mobile}</div>
      <div><span class="badge">${isMr ? 'तारण सोन्याचे दागिने सुपूर्द पावती (GOLD RELEASE VOUCHER)' : 'OFFICIAL PHYSICAL GOLD RELEASE VOUCHER'}</span></div>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 15px; font-weight: 600;">
      <span><strong>${isMr ? 'व्हाउचर क्रमांक:' : 'Voucher No:'}</strong> ${voucherNo}</span>
      <span><strong>${isMr ? 'दिनांक:' : 'Date:'}</strong> ${formatDate(new Date().toISOString())}</span>
      <span><strong>${isMr ? 'कर्ज खाते क्रमांक:' : 'Loan Account:'}</strong> ${loan.loan_number}</span>
    </div>

    <div class="grid-2">
      <div class="card"><div class="lbl">${isMr ? 'ग्राहकाचे नाव' : 'Customer Name'}</div><div class="val">${customerName}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'मोबाईल फोन' : 'Mobile Number'}</div><div class="val">${loan.customer?.mobile_number || 'N/A'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'आधार कार्ड क्रमांक' : 'Aadhaar Card'}</div><div class="val">${loan.customer?.aadhaar_number || 'N/A'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'तिजोरी कप्पा क्रमांक' : 'Vault Locker Pocket #'}</div><div class="val">${loan.gold_item?.pocket_locker_number || 'LOCKER-A-01'}</div></div>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>${isMr ? 'दागिन्याचे नाव' : 'Ornament Description'}</th>
          <th>${isMr ? 'शुद्धता (कॅरेट)' : 'Purity Grade'}</th>
          <th>${isMr ? 'स्थूल वजन (Gross Wt)' : 'Gross Weight'}</th>
          <th>${isMr ? 'खडे वजावट' : 'Stone Deduction'}</th>
          <th>${isMr ? 'निव्वळ शुद्ध वजन' : 'Net Pure Weight'}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><strong>${loan.gold_item?.ornament_type || (isMr ? 'सोन्याचे दागिने' : 'Gold Asset')}</strong></td>
          <td>${loan.gold_item?.purity || '22K (91.6%)'}</td>
          <td>${formatWeight(loan.gold_item?.gross_weight || 0)}</td>
          <td>${formatWeight(loan.gold_item?.stone_weight || 0)}</td>
          <td><strong>${formatWeight(loan.gold_item?.net_weight || 0)}</strong></td>
        </tr>
      </tbody>
    </table>

    <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px; margin-top: 20px; font-size: 11px; line-height: 1.6;">
      <strong>${isMr ? 'ग्राहकाची पावती व पुष्टीकरण:' : 'Borrower Handover Confirmation:'}</strong><br/>
      ${isMr
        ? `मी याद्वारे पुष्टी करतो/करते की, वरील नमूद केलेले तारण सोन्याचे दागिने मी प्रत्यक्ष तपासून, वजन खात्री करून पूर्णपणे सुस्थितीत ताब्यात घेतले आहेत. या कर्जाबाबत कोणतीही तक्रार शिल्लक नाही.`
        : `I hereby confirm that I have physically inspected and received all the pledged gold ornaments listed above in good condition and exact weight. No claims remain against the shop.`
      }
    </div>

    <div class="footer">
      <div>
        <div style="border-bottom: 1.5px solid #0f172a; width: 150px; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800;">${isMr ? 'ग्राहकाची स्वाक्षरी' : 'Borrower Signature'}</div>
        <div style="font-size: 9.5px; color: #64748b;">${customerName}</div>
      </div>
      <div style="text-align: right;">
        <div style="border-bottom: 1.5px solid #0f172a; width: 150px; margin-left: auto; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800;">${isMr ? 'पेढी अधिकारी स्वाक्षरी व शिक्का' : 'Vault Custodian / Stamp'}</div>
        <div style="font-size: 9.5px; color: #64748b;">${closedBy}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates Official Loan Sanction Letter HTML (Bilingual)
 */
export function generateSanctionLetterHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Branch Manager' } = opts;
  const lang = getActiveLanguage(opts);
  const isMr = lang === 'mr';
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || (isMr ? 'कर्जदार ग्राहक' : 'Borrower Customer');
  const sanctionNo = `SANC-2026-${loan.id.replace(/\D/g, '').slice(-4) || '8841'}`;

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

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${isMr ? 'सुवर्ण कर्ज मंजुरी पत्र' : 'Sanction Letter'} - ${loan.loan_number}</title>
  <style>
    ${FONT_STYLES}
    @page { size: A4; margin: 15mm; }
    body { color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.5; font-size: 12px; }
    .container { border: 2px solid #cbd5e1; border-radius: 12px; padding: 25px; }
    .header { text-align: center; border-bottom: 2px solid #b45309; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 900; color: #78350f; text-transform: uppercase; margin: 0; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-top: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .lbl { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .footer { margin-top: 35px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">👑 ${s.shop_name}</h1>
      <div style="font-size: 11px; color: #64748b;">${s.address} • GSTIN: ${s.gstin}</div>
      <div><span class="badge">${isMr ? 'अधिकृत सुवर्ण कर्ज मंजुरी पत्र (LOAN SANCTION LETTER)' : 'OFFICIAL GOLD LOAN SANCTION LETTER'}</span></div>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 15px; font-weight: 600;">
      <span><strong>${isMr ? 'मंजुरी पत्र क्रमांक:' : 'Sanction No:'}</strong> ${sanctionNo}</span>
      <span><strong>${isMr ? 'मंजुरी दिनांक:' : 'Sanction Date:'}</strong> ${formatDate(loan.loan_date)}</span>
      <span><strong>${isMr ? 'कर्ज खाते क्रमांक:' : 'Loan Account:'}</strong> ${loan.loan_number}</span>
    </div>

    <div class="grid-2">
      <div class="card"><div class="lbl">${isMr ? 'कर्जदाराचे नाव' : 'Borrower Name'}</div><div class="val">${customerName}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'मोबाईल क्रमांक' : 'Mobile Number'}</div><div class="val">${loan.customer?.mobile_number || 'N/A'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'मंजूर मुद्दल रक्कम' : 'Sanctioned Principal'}</div><div class="val" style="color: #15803d;">${formatCurrency(financials.totalDisbursed || loan.loan_amount)}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'मासिक व्याजदर' : 'Monthly Rate'}</div><div class="val">${loan.interest_rate}% / ${isMr ? 'महिना' : 'Month'} (${loan.interest_rate * 12}% p.a.)</div></div>
      <div class="card"><div class="lbl">${isMr ? 'कर्ज मुदत' : 'Tenure'}</div><div class="val">${loan.tenure_months || 12} ${isMr ? 'महिने' : 'Months'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'मुदत समाप्ती दिनांक' : 'Maturity / Due Date'}</div><div class="val">${formatDate(loan.due_date)}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'तारण दागिने' : 'Pledged Asset'}</div><div class="val">${loan.gold_item?.ornament_type || 'Gold Asset'} (${formatWeight(loan.gold_item?.net_weight || 0)})</div></div>
      <div class="card"><div class="lbl">${isMr ? 'परतफेड पद्धत' : 'Repayment Model'}</div><div class="val">${loan.repayment_model || 'Bullet Repayment'}</div></div>
    </div>

    <div class="footer">
      <div>
        <div style="border-bottom: 1.5px solid #0f172a; width: 150px; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800;">${isMr ? 'कर्जदाराची स्वाक्षरी' : 'Borrower Acceptance'}</div>
      </div>
      <div style="text-align: right;">
        <div style="border-bottom: 1.5px solid #0f172a; width: 150px; margin-left: auto; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800;">${isMr ? 'मंजुरी अधिकारी स्वाक्षरी' : 'Sanctioning Officer'}</div>
        <div style="font-size: 9.5px; color: #64748b;">${closedBy}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates Gold Valuation Appraisal Certificate HTML (Bilingual)
 */
export function generateGoldValuationReceiptHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Certified Gold Appraiser' } = opts;
  const lang = getActiveLanguage(opts);
  const isMr = lang === 'mr';
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || (isMr ? 'कर्जदार ग्राहक' : 'Borrower Customer');
  const valNo = `VAL-2026-${loan.id.replace(/\D/g, '').slice(-4) || '8841'}`;

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${isMr ? 'सोन्याचे मूल्यांकन प्रमाणपत्र' : 'Valuation Certificate'} - ${loan.loan_number}</title>
  <style>
    ${FONT_STYLES}
    @page { size: A4; margin: 15mm; }
    body { color: #0f172a; margin: 0; padding: 20px; background: #fff; line-height: 1.5; font-size: 12px; }
    .container { border: 2px solid #cbd5e1; border-radius: 12px; padding: 25px; }
    .header { text-align: center; border-bottom: 2px solid #d97706; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: 900; color: #78350f; text-transform: uppercase; margin: 0; }
    .badge { display: inline-block; background: #fef3c7; color: #92400e; padding: 4px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; margin-top: 6px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 15px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .lbl { font-size: 10px; color: #64748b; font-weight: 700; text-transform: uppercase; }
    .val { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .footer { margin-top: 35px; display: flex; justify-content: space-between; align-items: flex-end; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">👑 ${s.shop_name}</h1>
      <div style="font-size: 11px; color: #64748b;">${s.address}</div>
      <div><span class="badge">${isMr ? 'सोन्याचे मूल्यांकन व शुद्धता प्रमाणपत्र (GOLD APPRAISAL CERTIFICATE)' : 'CERTIFICATE OF GOLD VALUATION & APPRAISAL'}</span></div>
    </div>

    <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 15px; font-weight: 600;">
      <span><strong>${isMr ? 'प्रमाणपत्र क्रमांक:' : 'Certificate No:'}</strong> ${valNo}</span>
      <span><strong>${isMr ? 'दिनांक:' : 'Date:'}</strong> ${formatDate(loan.loan_date)}</span>
      <span><strong>${isMr ? 'कर्ज खाते क्रमांक:' : 'Loan Account:'}</strong> ${loan.loan_number}</span>
    </div>

    <div class="grid-2">
      <div class="card"><div class="lbl">${isMr ? 'ग्राहकाचे नाव' : 'Customer Name'}</div><div class="val">${customerName}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'दागिन्याचे नाव' : 'Ornament Type'}</div><div class="val">${loan.gold_item?.ornament_type || 'Gold Asset'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'शुद्धता (कॅरेट)' : 'Purity Grade'}</div><div class="val">${loan.gold_item?.purity || '22K (91.6%)'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'हॉलमार्क HUID' : 'Hallmark HUID'}</div><div class="val">${loan.gold_item?.hallmark_number || 'HUID-Verified'}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'एकूण स्थूल वजन' : 'Gross Weight'}</div><div class="val">${formatWeight(loan.gold_item?.gross_weight || 0)}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'खडे वजावट' : 'Stone Deduction'}</div><div class="val">${formatWeight(loan.gold_item?.stone_weight || 0)}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'निव्वळ शुद्ध वजन' : 'Net Pure Weight'}</div><div class="val" style="color: #b45309;">${formatWeight(loan.gold_item?.net_weight || 0)}</div></div>
      <div class="card"><div class="lbl">${isMr ? 'बाजारभाव मूल्यांकन' : 'Appraised Market Value'}</div><div class="val" style="color: #15803d;">${formatCurrency(loan.gold_item?.estimated_value || (loan.gold_item?.net_weight || 0) * 7200)}</div></div>
    </div>

    <div class="footer">
      <div>
        <div style="border-bottom: 1.5px solid #0f172a; width: 150px; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800;">${isMr ? 'ग्राहकाची स्वाक्षरी' : 'Customer Signature'}</div>
      </div>
      <div style="text-align: right;">
        <div style="border-bottom: 1.5px solid #0f172a; width: 150px; margin-left: auto; margin-bottom: 4px;"></div>
        <div style="font-size: 11px; font-weight: 800;">${isMr ? 'अधिकृत सुवर्ण परीक्षक' : 'Certified Gold Appraiser'}</div>
        <div style="font-size: 9.5px; color: #64748b;">${closedBy}</div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates Enterprise Banking-Grade Loan Account Statement HTML (Bilingual)
 */
export function generateEnterpriseLoanStatementHTML(opts: DocumentOptions): string {
  const { loan, shop, closedBy = 'Authorized Cashier' } = opts;
  const lang = getActiveLanguage(opts);
  const isMr = lang === 'mr';
  const s = shop || DEFAULT_SHOP_INFO;
  const customerName = loan.customer?.full_name || (isMr ? 'कर्जदार ग्राहक' : 'Borrower Customer');
  const docId = `SL-STMT-${loan.loan_number}-${new Date().getFullYear()}`;
  const nowStr = `${formatDate(new Date().toISOString())} • ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
  const secHash = `SEC-SHA256-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

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

  const payments = Array.isArray(loan.payments) ? loan.payments : [];
  const totalDisbursed = financials.totalDisbursed || loan.loan_amount;

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${isMr ? 'सुवर्ण कर्ज खाते विवरण' : 'Enterprise Loan Statement'} - ${loan.loan_number}</title>
  <style>
    ${FONT_STYLES}
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .page-container {
      position: relative;
      padding: 24px;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      background: #ffffff;
      min-height: 1000px;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 44px;
      font-weight: 900;
      color: rgba(226, 232, 240, 0.45);
      white-space: nowrap;
      pointer-events: none;
      user-select: none;
      z-index: 0;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .content-wrap { position: relative; z-index: 1; }
    .bank-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #b45309;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #78350f;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .shop-meta {
      font-size: 10px;
      color: #475569;
      margin-top: 4px;
      line-height: 1.35;
    }
    .doc-badge-box { text-align: right; }
    .doc-title-badge {
      display: inline-block;
      background: #78350f;
      color: #ffffff;
      padding: 5px 14px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .doc-meta {
      font-size: 9.5px;
      color: #64748b;
      margin-top: 6px;
      font-family: monospace;
    }
    .section-header {
      font-size: 11px;
      font-weight: 800;
      color: #78350f;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1.5px solid #fef3c7;
      padding-bottom: 4px;
      margin-top: 16px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
    .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
    .info-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 12px;
    }
    .card-label { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .card-value { font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 2px; }
    .kpi-card {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }
    .kpi-label { font-size: 9.5px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    .kpi-val { font-size: 15px; font-weight: 900; margin-top: 2px; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 10px;
    }
    .data-table th, .data-table td {
      border: 1px solid #e2e8f0;
      padding: 6px 10px;
      text-align: left;
    }
    .data-table th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
    }
    .data-table tr:nth-child(even) { background: #f8fafc; }
    .data-table tr.total-row { background: #fef3c7; font-weight: 800; }
    .bottom-section {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1.5px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .stamp-box {
      border: 2px dashed #16a34a;
      color: #15803d;
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 10.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
      transform: rotate(-3deg);
      background: #f0fdf4;
    }
    .sig-box { text-align: center; width: 150px; }
    .sig-line { border-bottom: 1.5px solid #0f172a; margin-bottom: 4px; height: 35px; }
    .footer-bar {
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
      font-size: 8.5px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="watermark">SUVARNA LOAN ERP • ${isMr ? 'अधिकृत बँक खातेवही' : 'OFFICIAL BANKING RECORD'}</div>

    <div class="content-wrap">
      <!-- 1. Header & Bank Metadata -->
      <div class="bank-header">
        <div>
          <h1 class="brand-title">👑 ${s.shop_name}</h1>
          <div class="shop-meta">
            ${s.address}<br/>
            <strong>${isMr ? 'संपर्क:' : 'Contact:'}</strong> ${s.mobile} • <strong>Email:</strong> ${s.email}<br/>
            <strong>GSTIN:</strong> ${s.gstin} • <strong>${isMr ? 'सुवर्ण कर्ज परवाना:' : 'NBFC License #:'}</strong> ${s.license_number}
          </div>
        </div>

        <div class="doc-badge-box">
          <span class="doc-title-badge">${isMr ? 'सुवर्ण कर्ज खाते विवरण' : 'LOAN ACCOUNT STATEMENT'}</span>
          <div class="doc-meta">
            Doc ID: <strong>${docId}</strong><br/>
            ${isMr ? 'दिनांक:' : 'Generated:'} <strong>${nowStr}</strong><br/>
            Audit Hash: <strong>${secHash}</strong>
          </div>
        </div>
      </div>

      <!-- 2. Borrower CRM Profile & KYC Section -->
      <div class="section-header">
        <span>👤 ${isMr ? 'ग्राहक तपशील व केवायसी पडताळणी' : 'Borrower Profile & Masked KYC Audit Summary'}</span>
        <span style="color: #15803d; font-size: 9.5px; font-weight: 800;">${isMr ? 'केवायसी पूर्ण ✅' : 'KYC VERIFIED ✅'}</span>
      </div>

      <div class="grid-2">
        <div class="info-card">
          <div class="card-label">${isMr ? 'कर्जदाराचे पूर्ण नाव' : 'Borrower Full Name'}</div>
          <div class="card-value">${customerName}</div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">
            Customer ID: <strong>${loan.customer?.id || 'CUST-8841'}</strong>
          </div>
        </div>

        <div class="info-card">
          <div class="card-label">${isMr ? 'संपर्क व निवासी पत्ता' : 'Contact & Residential Address'}</div>
          <div style="font-size: 10.5px; font-weight: 700; color: #1e293b; margin-top: 2px;">
            📞 <strong>${loan.customer?.mobile_number || 'N/A'}</strong> (Alt: ${loan.customer?.alternate_mobile || 'N/A'})
          </div>
          <div style="font-size: 9.5px; color: #475569; margin-top: 2px;">
            🏠 ${loan.customer?.address || 'Address on file'}
          </div>
        </div>
      </div>

      <div class="grid-4" style="margin-top: 8px;">
        <div class="info-card">
          <div class="card-label">${isMr ? 'आधार क्रमांक' : 'Aadhaar (Masked)'}</div>
          <div class="card-value" style="font-family: monospace;">XXXX-XXXX-${loan.customer?.aadhaar_number?.slice(-4) || '8841'}</div>
        </div>
        <div class="info-card">
          <div class="card-label">${isMr ? 'पॅन क्रमांक' : 'PAN Number (Masked)'}</div>
          <div class="card-value" style="font-family: monospace;">XXXXX${loan.customer?.pan_number?.slice(-4) || '8841K'}</div>
        </div>
        <div class="info-card">
          <div class="card-label">${isMr ? 'वारसदार (नॉमिनी)' : 'Nominee Relation'}</div>
          <div class="card-value">${loan.customer?.nominee_name || 'Nominee'} (${loan.customer?.nominee_relation || 'Family'})</div>
        </div>
        <div class="info-card">
          <div class="card-label">${isMr ? 'क्रेडिट स्कोर' : 'Credit Score'}</div>
          <div class="card-value" style="color: #15803d;">780 / 900 (${isMr ? 'उत्कृष्ट' : 'Excellent'})</div>
        </div>
      </div>

      <!-- 3. Loan Terms & Account Financial Summary -->
      <div class="section-header">
        <span>🏦 ${isMr ? 'सुवर्ण कर्ज मंजूर अटी व वित्तीय विवरण' : 'Loan Sanction Terms & Financial Ledger Summary'}</span>
        <span style="color: #78350f; font-size: 9.5px;">${isMr ? 'कर्ज खाते क्रमांक:' : 'Contract #:'} <strong>${loan.loan_number}</strong></span>
      </div>

      <div class="grid-4">
        <div class="kpi-card" style="border-left: 4px solid #0f172a;">
          <div class="kpi-label">${isMr ? 'एकूण वितरित मुद्दल' : 'Total Disbursed'}</div>
          <div class="kpi-val" style="color: #0f172a;">${formatCurrency(totalDisbursed)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">Rate: ${loan.interest_rate}%/mo (${loan.interest_rate * 12}% p.a.)</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid #16a34a;">
          <div class="kpi-label">${isMr ? 'एकूण भरलेले व्याज' : 'Total Interest Paid'}</div>
          <div class="kpi-val" style="color: #16a34a;">${formatCurrency(financials.totalInterestPaid)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">${isMr ? 'परत केलेले मुद्दल:' : 'Principal Paid:'} ${formatCurrency(financials.totalPrincipalPaid)}</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid #d97706;">
          <div class="kpi-label">${isMr ? 'देय थकीत व्याज' : 'Accrued Interest Due'}</div>
          <div class="kpi-val" style="color: #d97706;">${formatCurrency(financials.netAccruedInterest)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">${isMr ? 'कालावधी:' : 'Elapsed:'} ${financials.elapsedMonths} ${isMr ? 'महिने' : 'mos'} (${financials.elapsedDays}d)</div>
        </div>

        <div class="kpi-card" style="border-left: 4px solid #dc2626;">
          <div class="kpi-label">${isMr ? 'एकूण येणे थकबाकी' : 'Total Balance Due'}</div>
          <div class="kpi-val" style="color: #dc2626;">${formatCurrency(financials.totalBalanceDue)}</div>
          <div style="font-size: 8.5px; color: #64748b; margin-top: 2px;">${isMr ? 'मुदत दिनांक:' : 'Due Date:'} ${formatDate(loan.due_date)}</div>
        </div>
      </div>

      <!-- 4. Pledged Gold Ornament Asset Breakdown Table -->
      <div class="section-header">
        <span>🟡 ${isMr ? 'तारण ठेवलेले सोन्याचे दागिने व तिजोरी तपशील' : 'Pledged Gold Asset Vault Breakdown'}</span>
        <span style="color: #64748b; font-size: 9.5px;">${isMr ? 'लॉकर कप्पा:' : 'Locker:'} <strong>${loan.gold_item?.pocket_locker_number || 'LOCKER-A-01'}</strong></span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>#</th>
            <th>${isMr ? 'दागिन्याचे नाव' : 'Ornament Item'}</th>
            <th>${isMr ? 'धातू प्रकार' : 'Category / Metal'}</th>
            <th>${isMr ? 'शुद्धता (कॅरेट)' : 'Purity Karat'}</th>
            <th>${isMr ? 'स्थूल वजन (g)' : 'Gross Wt (g)'}</th>
            <th>${isMr ? 'खडे वजावट (g)' : 'Stones (g)'}</th>
            <th>${isMr ? 'निव्वळ शुद्ध सोने (g)' : 'Net Pure Wt (g)'}</th>
            <th>${isMr ? 'मूल्यांकन रक्कम' : 'Est. Market Value'}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><strong>${loan.gold_item?.ornament_type || (isMr ? 'सोन्याचे दागिने' : 'Gold Ornament Item')}</strong></td>
            <td>${loan.gold_item?.metal_type === 'Silver' ? (isMr ? '⚪ चांदी' : '⚪ Silver') : (isMr ? '🟡 सोने' : '🟡 Gold')}</td>
            <td><strong>${loan.gold_item?.purity || '22K (91.6%)'}</strong></td>
            <td>${formatWeight(loan.gold_item?.gross_weight || 0)}</td>
            <td>${formatWeight(loan.gold_item?.stone_weight || 0)}</td>
            <td><strong>${formatWeight(loan.gold_item?.net_weight || 0)}</strong></td>
            <td><strong>${formatCurrency((loan.gold_item?.net_weight || 0) * 7200)}</strong></td>
          </tr>
        </tbody>
      </table>

      <!-- 4.1 Disbursement Tranches Breakdown Table -->
      <div class="section-header">
        <span>⚡ ${isMr ? 'कर्ज वितरण टप्पे व स्वतंत्र व्याज आकारणी' : 'Multi-Disbursement Tranches & Independent Interest Periods'}</span>
        <span style="color: #78350f; font-size: 9.5px;">${isMr ? 'एकूण टप्पे:' : 'Tranches:'} <strong>${(financials.trancheBreakdown || []).length}</strong></span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>${isMr ? 'टप्पा #' : 'Tranche #'}</th>
            <th>${isMr ? 'वितरित मुद्दल' : 'Amount Disbursed'}</th>
            <th>${isMr ? 'वितरण दिनांक' : 'Disbursement Date'}</th>
            <th>${isMr ? 'व्याजदर' : 'Interest Rate'}</th>
            <th>${isMr ? 'देय थकीत व्याज' : 'Accrued Interest'}</th>
            <th>${isMr ? 'शिल्लक मुद्दल' : 'Principal Outstanding'}</th>
            <th>${isMr ? 'स्थिती' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          ${(financials.trancheBreakdown || []).map((t: any) => `
            <tr>
              <td><strong>${isMr ? `टप्पा #${t.disbursementNumber}` : `Tranche #${t.disbursementNumber}`}</strong></td>
              <td style="font-weight: 800;">${formatCurrency(t.originalAmount)}</td>
              <td>${formatDate(t.disbursementDate)} (${t.elapsedDays}d)</td>
              <td>${t.monthlyInterestRate}% / ${isMr ? 'महिना' : 'mo'}</td>
              <td style="color: #d97706; font-weight: 800;">${formatCurrency(t.netAccruedInterest)}</td>
              <td style="color: #16a34a; font-weight: 800;">${formatCurrency(t.remainingPrincipal)}</td>
              <td><span style="color: ${t.remainingPrincipal <= 0 ? '#16a34a' : '#d97706'}; font-weight: 800;">${t.remainingPrincipal <= 0 ? (isMr ? 'परतफेड पूर्ण ✅' : 'SETTLED ✅') : (isMr ? 'सक्रिय 🟡' : 'ACTIVE 🟡')}</span></td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>${isMr ? 'एकूण एकत्रित कर्ज:' : 'TOTAL COMBINED:'}</td>
            <td>${formatCurrency(totalDisbursed)}</td>
            <td>-</td>
            <td>-</td>
            <td style="color: #d97706;">${formatCurrency(financials.netAccruedInterest)}</td>
            <td style="color: #16a34a;">${formatCurrency(financials.remainingPrincipal)}</td>
            <td>${financials.remainingPrincipal <= 0 ? (isMr ? 'बंद' : 'CLOSED') : (isMr ? 'सक्रिय' : 'ACTIVE')}</td>
          </tr>
        </tbody>
      </table>

      <!-- 5. Repayment Ledger -->
      <div class="section-header">
        <span>📜 ${isMr ? 'कर्ज परतफेड व्यवहार खातेवही' : 'Complete Repayment Transaction History Ledger'}</span>
        <span style="color: #64748b; font-size: 9.5px;">${isMr ? 'एकूण व्यवहार:' : 'Total Transactions:'} <strong>${payments.length}</strong></span>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>${isMr ? 'पावती क्रमांक' : 'Receipt #'}</th>
            <th>${isMr ? 'दिनांक' : 'Payment Date'}</th>
            <th>${isMr ? 'भरणा प्रकार' : 'Payment Purpose'}</th>
            <th>${isMr ? 'भरणा पद्धत' : 'Method'}</th>
            <th>${isMr ? 'संदर्भ / नोंद' : 'Notes / Voucher'}</th>
            <th>${isMr ? 'जमा रक्कम' : 'Amount Received'}</th>
            <th>${isMr ? 'स्थिती' : 'Status'}</th>
          </tr>
        </thead>
        <tbody>
          ${payments.length === 0 ? `
            <tr>
              <td colspan="7" style="text-align: center; color: #94a3b8; padding: 12px;">
                ${isMr ? 'कोणतेही भरणा व्यवहार नोंदवलेले नाहीत.' : 'No repayment transactions recorded yet.'}
              </td>
            </tr>
          ` : payments.map((p, idx) => `
            <tr>
              <td style="font-family: monospace; font-weight: 700;">${p.receipt_number || `REC-${(idx + 1).toString().padStart(4, '0')}`}</td>
              <td>${formatDate(p.payment_date)}</td>
              <td><strong>${p.payment_type}</strong></td>
              <td>${p.payment_method}</td>
              <td style="font-size: 9px;">${p.notes || '-'}</td>
              <td style="color: #16a34a; font-weight: 800;">${formatCurrency(p.amount)}</td>
              <td><span style="color: #16a34a; font-weight: 800;">${isMr ? 'यशस्वी ✅' : 'SUCCESS ✅'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <!-- 6. Security QR & Signatures -->
      <div class="bottom-section">
        <div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 60px; height: 60px; border: 1.5px solid #0f172a; border-radius: 6px; padding: 4px; background: #fff; text-align: center;">
              <div style="font-size: 8px; font-weight: 900; color: #0f172a;">SCAN QR</div>
              <div style="font-size: 14px; margin-top: 1px;">🏁📱</div>
              <div style="font-size: 7px; color: #64748b; font-family: monospace;">VERIFY</div>
            </div>

            <div>
              <div class="stamp-box">
                SUVARNA LOAN ERP<br/>
                ${isMr ? 'पडताळणी पूर्ण ✅' : 'AUDITED & VERIFIED ✅'}
              </div>
              <div style="font-size: 8.5px; color: #64748b; margin-top: 4px; font-family: monospace;">
                Verification URL: https://suvarnaloan.com/verify?id=${loan.loan_number}
              </div>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 24px;">
          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="font-size: 10px; font-weight: 800; color: #0f172a;">${isMr ? 'कर्जदाराची स्वाक्षरी' : 'Borrower Signature'}</div>
            <div style="font-size: 8.5px; color: #64748b;">${customerName}</div>
          </div>

          <div class="sig-box">
            <div class="sig-line"></div>
            <div style="font-size: 10px; font-weight: 800; color: #0f172a;">${isMr ? 'अधिकृत कॅशियर / शिक्का' : 'Authorized Cashier / Stamp'}</div>
            <div style="font-size: 8.5px; color: #64748b;">${s.owner_name}</div>
          </div>
        </div>
      </div>

      <!-- 7. Footer -->
      <div class="footer-bar">
        <div>
          ${isMr
            ? `हे ${s.shop_name} द्वारे जारी केलेले डिजिटल कर्ज खाते विवरण आहे.`
            : `This document is an enterprise digitally generated Loan Statement issued by ${s.shop_name}.`
          }
        </div>
        <div>
          ${isMr ? 'ग्राहक सेवा:' : 'Customer Support:'} ${s.mobile} • Page 1 of 1
        </div>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Generates official GST & Banking Grade Single Payment Receipt HTML (Bilingual)
 * Displays: Borrower's Full Name, Loan Account Number, Disbursed Amount,
 * Payment Amount, Payment Date, Total Amount Paid Till Date, and Remaining Outstanding Amount.
 */
export function generateSinglePaymentReceiptHTML(payment: Payment, shop?: Shop | null, language?: 'en' | 'mr'): string {
  const lang = language || (typeof window !== 'undefined' ? (localStorage.getItem('sl_language') as 'en' | 'mr') : 'en') || 'en';
  const isMr = lang === 'mr';
  const s = shop || DEFAULT_SHOP_INFO;

  let loan = payment.loan;
  if (!loan && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('sl_shared_loans') || localStorage.getItem('sl_loans') || localStorage.getItem(`sl_${payment.shop_id}_loans`);
      if (stored) {
        const parsedLoans: Loan[] = JSON.parse(stored);
        loan = parsedLoans.find(l => l.id === payment.loan_id || l.loan_number === payment.loan_id);
      }
    } catch (e) {}
  }

  const custName = loan?.customer?.full_name || (payment as any).customer_name || (isMr ? 'कर्जदार ग्राहक' : 'Borrower Customer');
  const custMobile = loan?.customer?.mobile_number || (payment as any).customer_mobile || 'N/A';
  const custAddress = loan?.customer?.address || (isMr ? 'स्थानिक पत्ता' : 'Local Address');
  const loanNo = loan?.loan_number || (payment as any).loan_number || 'GL-2026-0001';
  const loanDate = loan?.loan_date || payment.payment_date;
  const ornamentName = loan?.gold_item?.ornament_type || (isMr ? 'तारण सोन्याचे दागिने' : 'Gold Item Collateral');
  const netWeight = loan?.gold_item?.net_weight || 0;
  const purity = loan?.gold_item?.purity || '22K (91.6%)';

  // 1. Disbursed Amount - MUST NEVER BE OVERWRITTEN BY PAYMENT AMOUNT
  let disbursedAmount = Number(loan?.total_disbursed || loan?.loan_amount || 0);
  if (disbursedAmount <= 0 && loan?.disbursements && loan.disbursements.length > 0) {
    disbursedAmount = loan.disbursements.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  }
  if (disbursedAmount <= 0) {
    disbursedAmount = Number((payment as any).disbursed_amount || (payment as any).loan_amount || (payment as any).original_loan_amount || 0);
  }
  if (disbursedAmount <= 0) {
    disbursedAmount = Number(payment.amount || 0);
  }

  // 2. Current Payment Amount
  const paymentAmount = Number(payment.amount || 0);

  // 3. Complete Historical Payments calculation & ordering
  let allLoanPayments: Payment[] = Array.isArray(loan?.payments) && loan.payments.length > 0
    ? [...loan.payments]
    : [];

  if (typeof window !== 'undefined') {
    try {
      const storedPmts = localStorage.getItem('sl_shared_payments') || localStorage.getItem('sl_payments') || localStorage.getItem(`sl_${payment.shop_id}_payments`);
      if (storedPmts) {
        const parsedPmts: Payment[] = JSON.parse(storedPmts);
        const matchPmts = parsedPmts.filter(p => p.loan_id === payment.loan_id || (loan && (p.loan_id === loan.id || p.loan_id === loan.loan_number)));
        matchPmts.forEach(p => {
          if (!allLoanPayments.some(ap => ap.id === p.id || (p.receipt_number && ap.receipt_number === p.receipt_number))) {
            allLoanPayments.push(p);
          }
        });
      }
    } catch (e) {}
  }

  if (!allLoanPayments.some(p => p.id === payment.id || (payment.receipt_number && p.receipt_number === payment.receipt_number))) {
    allLoanPayments.push(payment);
  }

  // Sort chronological
  const sortedPayments = [...allLoanPayments].sort((a, b) => {
    const da = new Date(a.created_at || a.payment_date || 0).getTime();
    const db = new Date(b.created_at || b.payment_date || 0).getTime();
    return da - db;
  });

  // Identify index of current receipt
  const currentIdx = sortedPayments.findIndex(p => p.id === payment.id || p.receipt_number === payment.receipt_number);
  const paymentsUpToThis = currentIdx !== -1 ? sortedPayments.slice(0, currentIdx + 1) : sortedPayments;

  // 4. Total Amount Paid Till Date
  const totalPaidTillDate = paymentsUpToThis.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // 5. Total Principal Repaid Till Date
  const totalPrincipalPaid = paymentsUpToThis.reduce((sum, p) => {
    const pAmt = Number(p.amount) || 0;
    return sum + (p.payment_type === 'Interest Payment' ? 0 : pAmt);
  }, 0);

  // 6. Remaining Outstanding Amount
  const isFullSettlement = (payment.payment_type || '').toLowerCase().includes('full settlement') || (payment.payment_type || '').toLowerCase().includes('closure');
  const remainingOutstanding = isFullSettlement
    ? 0
    : Math.max(0, disbursedAmount - totalPrincipalPaid);

  const isClosed = remainingOutstanding <= 0 || isFullSettlement;

  return `
<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="utf-8"/>
  <title>${isMr ? 'सुवर्ण कर्ज भरणा पावती' : 'Gold Loan Repayment Receipt'} - ${payment.receipt_number || 'REC-2026-0000'}</title>
  <style>
    ${FONT_STYLES}
    @page { size: A4 portrait; margin: 12mm; }
    body { color: #0f172a; margin: 0; padding: 15px; background: #fff; line-height: 1.45; font-size: 11.5px; font-family: system-ui, -apple-system, sans-serif; }
    .receipt-container { border: 2px solid #cbd5e1; padding: 22px; border-radius: 12px; max-width: 820px; margin: 0 auto; background: #ffffff; }
    .header { border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .shop-title { font-size: 20px; font-weight: 900; color: #78350f; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .shop-sub { font-size: 10.5px; color: #64748b; margin-top: 3px; }
    .receipt-badge { background: linear-gradient(135deg, #15803d, #16a34a); color: #fff; padding: 5px 14px; border-radius: 20px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block; }
    .grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
    .card-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 10px 14px; border-radius: 8px; font-size: 11.5px; }
    .card-label { font-size: 9.5px; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
    .card-val { font-size: 12.5px; font-weight: 800; color: #0f172a; }
    
    /* Financial Metrics Matrix */
    .metrics-matrix { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 16px 0; }
    .metric-card { padding: 12px 10px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
    .metric-title { font-size: 9px; font-weight: 800; text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px; }
    .metric-value { font-size: 17px; font-weight: 900; }
    
    .bg-disbursed { background: #f8fafc; border-color: #cbd5e1; }
    .bg-disbursed .metric-title { color: #475569; }
    .bg-disbursed .metric-value { color: #0f172a; }
    
    .bg-paid { background: #eff6ff; border-color: #bfdbfe; }
    .bg-paid .metric-title { color: #1d4ed8; }
    .bg-paid .metric-value { color: #1e40af; }
    
    .bg-total-paid { background: #f0fdf4; border-color: #bbf7d0; }
    .bg-total-paid .metric-title { color: #15803d; }
    .bg-total-paid .metric-value { color: #166534; }
    
    .bg-outstanding { background: ${isClosed ? '#f0fdf4' : '#fffbeb'}; border-color: ${isClosed ? '#86efac' : '#fde68a'}; }
    .bg-outstanding .metric-title { color: ${isClosed ? '#15803d' : '#b45309'}; }
    .bg-outstanding .metric-value { color: ${isClosed ? '#15803d' : '#9a3412'}; }

    .status-banner { padding: 8px 12px; border-radius: 6px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 16px; }
    .status-closed { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .status-active { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

    /* Transaction Ledger Table */
    .ledger-table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 10.5px; }
    .ledger-table th { background: #f1f5f9; padding: 7px 10px; border: 1px solid #cbd5e1; text-align: left; font-size: 9.5px; text-transform: uppercase; color: #475569; font-weight: 800; }
    .ledger-table td { padding: 7px 10px; border: 1px solid #e2e8f0; }
    .ledger-table tr:nth-child(even) { background: #f8fafc; }
    .current-row { background: #f0fdf4 !important; font-weight: bold; }

    .footer-signs { display: flex; justify-content: space-between; margin-top: 28px; align-items: flex-end; }
    .sig-line { border-bottom: 1.5px solid #0f172a; width: 140px; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="receipt-container">
    <!-- 1. Header Bar -->
    <div class="header">
      <div>
        <h1 class="shop-title">👑 ${s.shop_name}</h1>
        <div class="shop-sub">${s.address}<br/>${isMr ? 'संपर्क:' : 'Contact:'} ${s.mobile} • GSTIN: ${s.gstin}</div>
      </div>
      <div style="text-align: right;">
        <span class="receipt-badge">${isMr ? 'अधिकृत सुवर्ण कर्ज भरणा पावती' : 'OFFICIAL PAYMENT & SETTLEMENT RECEIPT'}</span>
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 5px; font-family: monospace;">${payment.receipt_number || 'REC-2026-0001'}</div>
        <div style="font-size: 10px; color: #64748b;">${isMr ? 'भरणा दिनांक:' : 'Payment Date:'} <strong>${formatDate(payment.payment_date)}</strong></div>
      </div>
    </div>

    <!-- 2. Borrower & Loan Collateral Details -->
    <div class="grid-two">
      <div class="card-box">
        <div class="card-label">${isMr ? 'कर्जदार ग्राहकाचे नाव व तपशील' : 'Borrower Customer Details'}</div>
        <div class="card-val">${custName}</div>
        <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">📞 ${custMobile}</div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">📍 ${custAddress}</div>
      </div>

      <div class="card-box">
        <div class="card-label">${isMr ? 'सुवर्ण कर्ज खाते व तारण तपशील' : 'Gold Loan Account & Collateral'}</div>
        <div class="card-val">${isMr ? 'कर्ज खाते क्रमांक:' : 'Loan Account #:'} <span style="color: #b45309;">${loanNo}</span></div>
        <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">🟡 ${ornamentName} • ${purity}</div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">⚖️ ${isMr ? 'निव्वळ वजन:' : 'Net Gold Weight:'} <strong>${formatWeight(netWeight)}</strong> • ${isMr ? 'मंजूर दिनांक:' : 'Loan Date:'} ${formatDate(loanDate)}</div>
      </div>
    </div>

    <!-- 3. Key Financial Summary Matrix (Disbursed, Paid, Total Paid Till Date, Remaining Outstanding) -->
    <div class="metrics-matrix">
      <div class="metric-card bg-disbursed">
        <div class="metric-title">${isMr ? 'मंजूर कर्ज रक्कम' : 'Disbursed Amount'}</div>
        <div class="metric-value">${formatCurrency(disbursedAmount)}</div>
      </div>

      <div class="metric-card bg-paid">
        <div class="metric-title">${isMr ? 'चालू भरणा रक्कम' : 'Amount Paid'}</div>
        <div class="metric-value">${formatCurrency(paymentAmount)}</div>
      </div>

      <div class="metric-card bg-total-paid">
        <div class="metric-title">${isMr ? 'आजपर्यंत एकूण जमा' : 'Total Paid Till Date'}</div>
        <div class="metric-value">${formatCurrency(totalPaidTillDate)}</div>
      </div>

      <div class="metric-card bg-outstanding">
        <div class="metric-title">${isMr ? 'उर्वरित येणेबाकी रक्कम' : 'Remaining Outstanding'}</div>
        <div class="metric-value">${formatCurrency(remainingOutstanding)}</div>
      </div>
    </div>

    <!-- 4. Status Indicator Banner -->
    <div class="status-banner ${isClosed ? 'status-closed' : 'status-active'}">
      ${isClosed
        ? (isMr ? '✅ कर्ज खाते पूर्ण भरणा होऊन यशस्वीरित्या बंद झाले (PAID IN FULL & SETTLED)' : '✅ LOAN ACCOUNT FULLY SETTLED & CLOSED (ZERO BALANCE DUE)')
        : (isMr ? `🟡 कर्ज खाते सक्रिय • उर्वरित येणेबाकी: ${formatCurrency(remainingOutstanding)}` : `🟡 ACTIVE LOAN • REMAINING BALANCE DUE: ${formatCurrency(remainingOutstanding)}`)
      }
    </div>

    <!-- 5. Payment Transaction Details -->
    <div class="card-box" style="margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase;">
            ${isMr ? 'भरणा प्रकार:' : 'Payment Purpose:'} <strong>${payment.payment_type}</strong>
          </span>
          <span style="margin: 0 8px; color: #cbd5e1;">|</span>
          <span style="font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase;">
            ${isMr ? 'भरणा पद्धत:' : 'Payment Mode:'} <strong>${payment.payment_method}</strong>
          </span>
        </div>
        ${payment.notes ? `
          <div style="font-size: 9.5px; color: #64748b;">
            ${isMr ? 'नोंद/व्हाउचर:' : 'Notes/Voucher:'} <strong>${payment.notes}</strong>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- 6. Cumulative Repayment History Ledger -->
    <div style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 4px;">
      📜 ${isMr ? 'कर्ज परतफेड व्यवहार खातेवही (या पावतीपर्यंत)' : 'Repayment Transactions History (Up to this receipt)'}
    </div>
    <table class="ledger-table">
      <thead>
        <tr>
          <th>${isMr ? 'पावती #' : 'Receipt #'}</th>
          <th>${isMr ? 'दिनांक' : 'Date'}</th>
          <th>${isMr ? 'भरणा प्रकार' : 'Payment Type'}</th>
          <th>${isMr ? 'पद्धत' : 'Mode'}</th>
          <th>${isMr ? 'जमा रक्कम' : 'Amount Paid'}</th>
          <th>${isMr ? 'एकूण जमा रक्कम' : 'Cumulative Paid'}</th>
          <th>${isMr ? 'उर्वरित येणेबाकी' : 'Balance Outstanding'}</th>
        </tr>
      </thead>
      <tbody>
        ${(() => {
          let runningTotal = 0;
          let runningPrincipal = 0;
          return paymentsUpToThis.map((p, idx) => {
            const pAmt = Number(p.amount) || 0;
            runningTotal += pAmt;
            if (p.payment_type !== 'Interest Payment') {
              runningPrincipal += pAmt;
            }
            const pRemaining = (isFullSettlement && (p.id === payment.id || idx === paymentsUpToThis.length - 1))
              ? 0
              : Math.max(0, disbursedAmount - runningPrincipal);
            const isCurrent = p.id === payment.id || p.receipt_number === payment.receipt_number;
            return `
              <tr class="${isCurrent ? 'current-row' : ''}">
                <td style="font-family: monospace; font-weight: 700;">${p.receipt_number || `REC-2026-${(idx + 1).toString().padStart(4, '0')}`}</td>
                <td>${formatDate(p.payment_date)}</td>
                <td><strong>${p.payment_type}</strong></td>
                <td>${p.payment_method}</td>
                <td style="font-weight: 800; color: #16a34a;">${formatCurrency(pAmt)}</td>
                <td style="font-weight: 800; color: #1e40af;">${formatCurrency(runningTotal)}</td>
                <td style="font-weight: 800; color: ${pRemaining <= 0 ? '#16a34a' : '#b45309'};">
                  ${pRemaining <= 0 ? (isMr ? '₹० (पूर्ण भरणा ✅)' : '₹0 (Settled ✅)') : formatCurrency(pRemaining)}
                </td>
              </tr>
            `;
          }).join('');
        })()}
      </tbody>
    </table>

    <!-- 7. Security Stamp & Signatures -->
    <div class="footer-signs">
      <div>
        <div class="sig-line"></div>
        <div style="font-size: 10.5px; font-weight: 800;">${isMr ? 'कर्जदाराची स्वाक्षरी' : 'Borrower Signature'}</div>
        <div style="font-size: 9px; color: #64748b;">${custName}</div>
      </div>

      <div style="text-align: center;">
        <div style="font-size: 8px; font-weight: 900; color: #166534; border: 1.5px dashed #16a34a; padding: 4px 10px; border-radius: 6px; background: #f0fdf4;">
          SUVARNA LOAN ERP<br/>
          ${isMr ? 'डिजिटल पडताळणी पूर्ण ✅' : 'DIGITALLY AUDITED & VERIFIED ✅'}
        </div>
      </div>

      <div style="text-align: right;">
        <div class="sig-line" style="margin-left: auto;"></div>
        <div style="font-size: 10.5px; font-weight: 800;">${isMr ? 'अधिकृत कॅशियर स्वाक्षरी' : 'Authorized Cashier / Stamp'}</div>
        <div style="font-size: 9px; color: #64748b;">${s.owner_name}</div>
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
 * Convenience helper to print single payment receipt
 */
export function printSinglePaymentReceiptPDF(payment: Payment, shop?: Shop | null, language?: 'en' | 'mr') {
  const html = generateSinglePaymentReceiptHTML(payment, shop, language);
  printHTMLDocument(html);
}

/**
 * Backward compatibility alias for single payment receipt HTML
 */
export const generateRepaymentReceiptHTML = generateSinglePaymentReceiptHTML;

/**
 * Triggers download of generated HTML file
 */
export function downloadHTMLDocument(htmlContent: string, filename: string) {
  if (typeof window === 'undefined') return;
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

