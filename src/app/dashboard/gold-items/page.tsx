'use client';

// ========================================================
// SuvarnaLoan ERP - Vault Inventory & Packet Tracking
// Supports English & Bank-Grade Marathi Localization
// Location: src/app/dashboard/gold-items/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Printer, Package, Search, Lock, ShieldCheck, Tag, FileSpreadsheet, FileCode } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { GoldItem } from '../../../types';
import { formatCurrency, formatWeight } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';
import { exportToPDF } from '../../../lib/pdf-export';
import { exportToXML } from '../../../lib/xml-export';
import { toast } from 'sonner';
import { useTranslation } from '../../../providers/LanguageProvider';

export default function GoldItemsPage() {
  const { dict, language, isMarathi } = useTranslation();

  const [items, setItems] = useState<GoldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadGoldItems = () => {
    const session = getSessionUser();
    const activeShopId = session?.user?.shop_id || session?.shop?.id || '';
    if (!activeShopId) {
      setLoading(false);
      return;
    }
    db.getGoldItems(activeShopId).then((data) => {
      setItems(data);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadGoldItems();

    const handleRealtimeUpdate = (e: any) => {
      if (!e.detail?.table || e.detail.table === 'gold_items' || e.detail.table === 'loans') {
        loadGoldItems();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
      window.addEventListener('suvarnaloan-db-update', loadGoldItems);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.removeEventListener('suvarnaloan-db-update', loadGoldItems);
      }
    };
  }, []);

  const filtered = React.useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return items;
    return items.filter(
      (g) =>
        (g.ornament_type && g.ornament_type.toLowerCase().includes(query)) ||
        (g.purity && g.purity.toLowerCase().includes(query)) ||
        (g.pocket_locker_number && g.pocket_locker_number.toLowerCase().includes(query)) ||
        (g.hallmark_number && g.hallmark_number.toLowerCase().includes(query))
    );
  }, [items, search]);

  const handleExport = () => {
    const rows = filtered.map((g) => ({
      'Locker #': g.pocket_locker_number,
      'Ornament Type': g.ornament_type,
      'Purity': g.purity,
      'Gross Weight (g)': g.gross_weight,
      'Stone Deduction (g)': g.stone_weight,
      'Net Weight (g)': g.net_weight,
      'Hallmark HUID': g.hallmark_number,
      'Estimated Value (₹)': g.estimated_value,
    }));

    const columnMap = isMarathi ? {
      'Locker #': 'लॉकर क्रमांक',
      'Ornament Type': 'दागिन्याचा प्रकार',
      'Purity': 'कॅरेट शुद्धता',
      'Gross Weight (g)': 'एकूण वजन (ग्रॅम)',
      'Stone Deduction (g)': 'खडे/लाख वजावट (ग्रॅम)',
      'Net Weight (g)': 'निव्वळ वजन (ग्रॅम)',
      'Hallmark HUID': 'हॉलमार्क HUID',
      'Estimated Value (₹)': 'बाजार मूल्य (₹)',
    } : undefined;

    exportToExcel(rows, `Vault_Gold_Inventory_${new Date().toISOString().split('T')[0]}`, 'Gold_Items', columnMap);
    toast.success(isMarathi ? 'सोन्याची नोंदवही एक्सेलमध्ये डाउनलोड झाली!' : 'Exported gold items inventory to Excel!');
  };

  const handleExportPDF = () => {
    const session = getSessionUser();
    exportToPDF({
      title: isMarathi ? 'तिजोरीतील सोन्याची नोंदवही व अहवाल' : 'Vault Inventory Stock Register Report',
      subtitle: isMarathi ? 'लॉकर पाकीट यादी, हॉलमार्क व मूल्यांकन तपशील' : 'Physical Locker Packet Inventory, Hallmarks & Valuation Manifest',
      columns: [
        dict.goldItem.vaultLocker,
        dict.goldItem.ornamentType,
        dict.goldItem.purity,
        dict.goldItem.grossWeight,
        dict.goldItem.netWeight,
        dict.goldItem.hallmarkHUID,
        dict.goldItem.appraisedValue,
      ],
      rows: filtered.map((g) => [
        g.pocket_locker_number || '',
        g.ornament_type || '',
        g.purity || '',
        formatWeight(g.gross_weight),
        formatWeight(g.net_weight),
        g.hallmark_number || 'N/A',
        formatCurrency(g.estimated_value || 0),
      ]),
      shop: session?.shop,
      filename: `Vault_Inventory_${new Date().toISOString().split('T')[0]}`,
    });
    toast.success(isMarathi ? 'सोन्याची नोंदवही PDF तयार झाली!' : 'Generated Vault PDF Report!');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Package className="w-6 h-6 text-amber-600" />
              <span>{dict.goldItem.title}</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              {dict.goldItem.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <Printer className="w-4 h-4 text-rose-600" />
              <span>{dict.reports.printReport}</span>
            </button>

            <button
              onClick={handleExport}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>{dict.reports.exportExcel}</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={isMarathi ? 'दागिना प्रकार, कॅरेट, किंवा लॉकर क्रमांक शोधा...' : 'Search ornament type, purity, or locker #...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">{dict.goldItem.vaultLocker}</th>
                  <th className="py-3 px-4">{dict.goldItem.ornamentType}</th>
                  <th className="py-3 px-4">{dict.goldItem.purity}</th>
                  <th className="py-3 px-4">{dict.goldItem.grossWeight}</th>
                  <th className="py-3 px-4">{dict.goldItem.stoneWeight}</th>
                  <th className="py-3 px-4">{dict.goldItem.netWeight}</th>
                  <th className="py-3 px-4">{dict.goldItem.hallmarkNumber}</th>
                  <th className="py-3 px-4 text-right">{dict.goldItem.appraisedValue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {dict.common.loading}
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {dict.common.noRecords}
                    </td>
                  </tr>
                ) : (
                  filtered.map((g) => (
                    <tr key={g.id} className="hover:bg-amber-50/20">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        <span className="flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{g.pocket_locker_number}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{g.ornament_type}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          {g.purity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">{formatWeight(g.gross_weight)}</td>
                      <td className="py-3.5 px-4 text-slate-500">{formatWeight(g.stone_weight)}</td>
                      <td className="py-3.5 px-4 font-bold text-amber-700">{formatWeight(g.net_weight)}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">{g.hallmark_number || 'N/A'}</td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        {formatCurrency(g.estimated_value)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
