// ========================================================
// SuvarnaLoan ERP - Bilingual Excel & CSV Export Helper
// Supports UTF-8 Devanagari Encoding & Localized Column Names
// Location: src/lib/excel-export.ts
// ========================================================

export async function exportToExcel(
  data: any[],
  filename: string,
  sheetName: string = 'Data',
  columnMap?: Record<string, string>
) {
  if (!data || !data.length) return;

  const transformedData = columnMap
    ? data.map((row) => {
        const newRow: Record<string, any> = {};
        Object.keys(row).forEach((key) => {
          const mappedKey = columnMap[key] || key;
          newRow[mappedKey] = row[key];
        });
        return newRow;
      })
    : data;

  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(transformedData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export async function exportToCSV(
  data: any[],
  filename: string,
  columnMap?: Record<string, string>
) {
  if (!data || !data.length) return;

  const transformedData = columnMap
    ? data.map((row) => {
        const newRow: Record<string, any> = {};
        Object.keys(row).forEach((key) => {
          const mappedKey = columnMap[key] || key;
          newRow[mappedKey] = row[key];
        });
        return newRow;
      })
    : data;

  const XLSX = await import('xlsx');
  const worksheet = XLSX.utils.json_to_sheet(transformedData);
  const csvContent = XLSX.utils.sheet_to_csv(worksheet);

  // Prepend UTF-8 Byte Order Mark (BOM) so Excel renders Marathi Devanagari perfectly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
