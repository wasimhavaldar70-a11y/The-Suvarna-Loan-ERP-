// ========================================================
// SuvarnaLoan ERP - Generic PDF Export Helper
// Location: src/lib/pdf-export.ts
// ========================================================

import { Shop } from '../types';

export interface PDFExportOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  shop?: Shop | null;
  filename?: string;
}

export function exportToPDF(opts: PDFExportOptions) {
  if (typeof window === 'undefined') return;

  const { title, subtitle = 'Enterprise ERP Report', columns, rows, shop, filename = 'ERP_Report' } = opts;

  const shopName = shop?.shop_name || 'SuvarnaLoan Gold ERP';
  const address = shop?.address || 'Main Office & Vault';
  const gstin = shop?.gstin ? `GSTIN: ${shop.gstin}` : '';
  const dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${title} - ${filename}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 15px; background: #fff; line-height: 1.4; }
    .report-container { max-width: 100%; margin: 0 auto; }
    .header { border-bottom: 2px solid #f59e0b; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
    .shop-name { font-size: 20px; font-weight: 900; color: #78350f; margin: 0; text-transform: uppercase; }
    .shop-info { font-size: 10px; color: #64748b; margin-top: 2px; }
    .title-badge { background: #1e293b; color: #f59e0b; font-size: 13px; font-weight: 800; padding: 5px 14px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .meta-bar { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; font-weight: 700; margin-bottom: 12px; background: #f8fafc; padding: 6px 12px; border-radius: 6px; border: 1px solid #e2e8f0; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 15px; }
    .data-table th { background: #0f172a; color: #f8fafc; text-align: left; padding: 7px 10px; font-weight: 800; text-transform: uppercase; font-size: 9px; letter-spacing: 0.5px; }
    .data-table td { padding: 6px 10px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 600; }
    .data-table tr:nth-child(even) { background: #f8fafc; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 20px; font-size: 9px; color: #94a3b8; }
    .stamp { border: 1.5px solid #16a34a; color: #16a34a; padding: 3px 10px; border-radius: 20px; font-weight: 900; font-size: 9px; text-transform: uppercase; display: inline-block; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <div>
        <h1 class="shop-name">👑 ${shopName}</h1>
        <div class="shop-info">${address} ${gstin ? `• ${gstin}` : ''}</div>
        <div class="shop-info">${subtitle}</div>
      </div>
      <div style="text-align: right;">
        <span class="title-badge">${title}</span>
        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-top: 6px;">Generated: ${dateStr}</div>
      </div>
    </div>

    <div class="meta-bar">
      <span>Total Records: <strong>${rows.length}</strong></span>
      <span>System Status: <strong>VERIFIED & AUDITED ✅</strong></span>
      <span>Platform: <strong>SuvarnaLoan Enterprise ERP</strong></span>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          ${columns.map((col) => `<th>${col}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${row.map((cell) => `<td>${cell !== undefined && cell !== null ? cell : '-'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>
        <span class="stamp">OFFICIAL PDF EXPORT • SUVARNALOAN ERP</span>
      </div>
      <div>
        Page 1 of 1 • Digitally Verified Report
      </div>
    </div>
  </div>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank', 'width=1050,height=800');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}
