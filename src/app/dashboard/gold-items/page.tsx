'use client';

// ========================================================
// SuvarnaLoan ERP - Vault Inventory & Packet Tracking
// Location: src/app/dashboard/gold-items/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import { Package, Search, Lock, ShieldCheck, Tag, FileSpreadsheet } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { GoldItem } from '../../../types';
import { formatCurrency, formatWeight } from '../../../lib/utils';
import { exportToExcel } from '../../../lib/excel-export';

export default function GoldItemsPage() {
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
    exportToExcel(rows, `Vault_Gold_Inventory_${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Vault Inventory & Pledged Gold Assets
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Physical locker packet allocation, HUID hallmark registry & ornament weight records
            </p>
          </div>

          <button
            onClick={handleExport}
            className="px-4 py-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 self-start md:self-auto transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Vault Manifest</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by locker #, ornament type, or HUID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Locker Packet #</th>
                  <th className="py-3 px-4">Ornament Breakdown</th>
                  <th className="py-3 px-4">Purity Karat</th>
                  <th className="py-3 px-4">Gross Wt</th>
                  <th className="py-3 px-4">Stone Wt</th>
                  <th className="py-3 px-4">Net Pure Weight</th>
                  <th className="py-3 px-4">Hallmark HUID</th>
                  <th className="py-3 px-4">Est. Valuation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      Loading vault items...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No pledged gold items found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((g) => (
                    <tr key={g.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4 font-extrabold text-amber-700 flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-600" />
                        <span>{g.pocket_locker_number || 'LOCKER-A-01'}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{g.ornament_type}</div>
                        <div className="text-[10px] text-slate-400 max-w-xs truncate">{g.description}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[10px]">
                          {g.purity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{formatWeight(g.gross_weight)}</td>
                      <td className="py-3.5 px-4 text-slate-500">{formatWeight(g.stone_weight)}</td>
                      <td className="py-3.5 px-4 font-extrabold text-slate-900">{formatWeight(g.net_weight)}</td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-700">{g.hallmark_number || 'N/A'}</td>
                      <td className="py-3.5 px-4 font-extrabold text-emerald-600">
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
