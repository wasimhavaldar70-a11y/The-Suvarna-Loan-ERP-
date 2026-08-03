// ========================================================
// SuvarnaLoan ERP - Generic XML Export Helper
// Location: src/lib/xml-export.ts
// ========================================================

export function exportToXML(
  data: Record<string, any>[],
  filename: string,
  rootElement = 'VaultManifest',
  itemElement = 'GoldItem'
) {
  if (!data || !data.length || typeof window === 'undefined') return;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElement} generatedAt="${new Date().toISOString()}" totalRecords="${data.length}">\n`;

  data.forEach((item) => {
    xml += `  <${itemElement}>\n`;
    Object.keys(item).forEach((key) => {
      const sanitizedKey = key.replace(/[^a-zA-Z0-9]/g, '');
      const rawVal = item[key];
      const val =
        rawVal !== undefined && rawVal !== null
          ? String(rawVal)
              .replace(/&/g, '&amp;')
              .replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
          : '';
      xml += `    <${sanitizedKey}>${val}</${sanitizedKey}>\n`;
    });
    xml += `  </${itemElement}>\n`;
  });

  xml += `</${rootElement}>`;

  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.xml') ? filename : `${filename}.xml`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
