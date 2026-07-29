'use client';

// ========================================================
// SuvarnaLoan ERP - Super Admin Platform Dashboard
// Location: src/app/admin/dashboard/page.tsx
// ========================================================

import React, { useState, useEffect } from 'react';
import SuperAdminLayout from '../../../components/SuperAdminLayout';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  Plus,
  Coins,
  ShieldCheck,
  TrendingUp,
  Search,
  CheckCircle2,
  X,
  Lock,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Edit2,
  Eye,
  Key,
  Power,
  Trash2,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import { onboardNewTenant, TenantRegistrationInput, generateNextShopId } from '../../../lib/onboardTenant';
import { db } from '../../../lib/supabase/supabaseDb';
import { getAllAuditLogs } from '../../../lib/auditLog';
import { Shop, AuditLog } from '../../../types';
import { formatCurrency, formatWeight } from '../../../lib/utils';
import { toast } from 'sonner';

export default function SuperAdminDashboardPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');
  const [provisionModalOpen, setProvisionModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resetModalShop, setResetModalShop] = useState<Shop | null>(null);
  const [newDirectPassword, setNewDirectPassword] = useState('password123');
  const [deleteModalShop, setDeleteModalShop] = useState<Shop | null>(null);

  // Super Admin Tab & Audit Log State
  const [activeTab, setActiveTab] = useState<'SHOPS' | 'AUDIT_LOGS'>('SHOPS');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');

  // Onboarding Form State
  const [autoShopId, setAutoShopId] = useState('');
  const [shopName, setShopName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerMobile, setOwnerMobile] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [plan, setPlan] = useState<'Trial' | 'Monthly' | 'Yearly' | 'Lifetime' | 'Starter' | 'Professional' | 'Enterprise'>('Professional');
  const [goldRate24k, setGoldRate24k] = useState(7650);
  const [goldRate22k, setGoldRate22k] = useState(7010);
  const [goldRate18k, setGoldRate18k] = useState(5738);
  const [silverRate1kg, setSilverRate1kg] = useState(95000);
  const [maxLtv, setMaxLtv] = useState(75);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [businessType, setBusinessType] = useState('Gold & Silver Jeweller Loan Finance');
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().split('T')[0]);
  const [shopStatus, setShopStatus] = useState<'Active' | 'Inactive'>('Active');

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    setLoading(true);
    try {
      const fetchedShops = await db.getAllShops();
      setShops(fetchedShops || []);
    } catch (err) {
      console.warn('Load shops error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const fetchedLogs = await getAllAuditLogs();
      setAuditLogs(fetchedLogs || []);
    } catch (err) {
      console.warn('Load audit logs error:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'AUDIT_LOGS') {
      loadAuditLogs();
    }
  }, [activeTab]);

  const handleProvisionShopOwner = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!shopName.trim()) {
      toast.error('Shop Name is required');
      return;
    }
    if (!ownerName.trim()) {
      toast.error('Owner Name is required');
      return;
    }
    if (!ownerMobile.trim() || ownerMobile.length < 10) {
      toast.error('Valid 10-digit Mobile Number is required');
      return;
    }
    if (!ownerEmail.trim() || !ownerEmail.includes('@')) {
      toast.error('Valid Owner Email is required');
      return;
    }
    if (!ownerPassword.trim() || ownerPassword.length < 6) {
      toast.error('Initial Password must be at least 6 characters');
      return;
    }

    setSubmitting(true);
    try {
      const input: TenantRegistrationInput = {
        shopId: autoShopId,
        shopName: shopName.trim(),
        ownerName: ownerName.trim(),
        ownerMobile: ownerMobile.trim(),
        ownerEmail: ownerEmail.trim(),
        ownerPassword: ownerPassword.trim(),
        plan,
        address: `${address.trim()}, ${city.trim()}, ${stateName.trim()} - ${pincode.trim()}`,
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        gstin: gstin.trim(),
        panNumber: panNumber.trim(),
        businessType: businessType.trim(),
        openingDate,
        status: shopStatus,
        goldRate24k,
        goldRate22k,
        goldRate18k,
        silverRate1kg,
        maxLtvPercentage: maxLtv,
      };

      const result = await onboardNewTenant(input);

      if (result.success && result.shop) {
        toast.success(`Successfully provisioned Shop "${result.shop.shop_name}" (${result.shop.id})! Active & isolated in Supabase.`);
        await loadShops();
        setProvisionModalOpen(false);

        // Reset Form
        setShopName('');
        setOwnerName('');
        setOwnerMobile('');
        setOwnerEmail('');
      } else {
        toast.error(result.error || 'Failed to provision tenant account');
      }
    } catch (err: any) {
      toast.error(err.message || 'Unexpected onboarding error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (shop: Shop) => {
    const currentStatus = shop.is_active ?? true;
    const newStatus = !currentStatus;
    toast.loading(`Updating status for ${shop.shop_name}...`);

    const success = await db.toggleShopStatus(shop.id, newStatus);
    toast.dismiss();

    if (success) {
      setShops((prev) =>
        prev.map((s) => (s.id === shop.id ? { ...s, is_active: newStatus } : s))
      );
      toast.success(
        `Shop "${shop.shop_name}" is now ${newStatus ? 'ACTIVE' : 'DEACTIVATED'} in database.`
      );
    } else {
      toast.error('Failed to update shop status in database');
    }
  };

  const handleResetPassword = async (shop: Shop, directPass?: string) => {
    if (!shop.email) {
      toast.error('No owner email associated with this shop');
      return;
    }
    toast.loading(`Updating password for ${shop.email}...`);
    const res = await db.resetShopOwnerPassword(shop.email, directPass);
    toast.dismiss();

    if (res.success) {
      toast.success(res.message);
      setResetModalShop(null);
    } else {
      toast.error(res.message);
    }
  };

  const handleDeleteShop = async (shop: Shop) => {
    toast.loading(`Deleting ${shop.shop_name} from database...`);
    const success = await db.deleteShop(shop.id);
    toast.dismiss();

    if (success) {
      setShops((prev) => prev.filter((s) => s.id !== shop.id));
      toast.success(`Shop "${shop.shop_name}" deleted from database.`);
      setDeleteModalShop(null);
    } else {
      toast.error('Failed to delete shop');
    }
  };

  const filteredShops = shops.filter((s) => {
    const q = search.toLowerCase();
    const matchesSearch =
      s.shop_name.toLowerCase().includes(q) ||
      s.owner_name.toLowerCase().includes(q) ||
      (s.email && s.email.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (planFilter === 'ALL') return true;
    return s.plan === planFilter;
  });

  const professionalCount = shops.filter((s) => s.plan === 'Professional').length;
  const enterpriseCount = shops.filter((s) => s.plan === 'Enterprise').length;
  const activeCount = shops.filter((s) => s.is_active !== false).length;

  return (
    <SuperAdminLayout>
      <div className="space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="p-3.5 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Platform Super Admin Dashboard</span>
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                Provision & manage Shop Owners, reset credentials, toggle active/deactivate status & persist in Supabase DB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={loadShops}
              className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh DB</span>
            </button>
            <button
              onClick={async () => {
                const nextId = await generateNextShopId();
                setAutoShopId(nextId);
                setProvisionModalOpen(true);
              }}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-105 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Provision New Shop Owner ID</span>
            </button>
          </div>
        </div>

        {/* Platform Metric KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Total Partner Shops</span>
              <div className="text-2xl font-black text-white mt-1">{shops.length}</div>
              <span className="text-[11px] font-semibold text-emerald-400">Persisted in Supabase</span>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
              <Building2 className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Active Tenants</span>
              <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
              <span className="text-[11px] font-semibold text-slate-400">Operating ERP Access</span>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Power className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-slate-400 tracking-wider">Enterprise Plans</span>
              <div className="text-2xl font-black text-purple-400 mt-1">{enterpriseCount}</div>
              <span className="text-[11px] font-semibold text-slate-400">High-Volume Jewelers</span>
            </div>
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-amber-950 p-5 rounded-2xl border border-amber-500/30 shadow-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] font-extrabold uppercase text-amber-300 tracking-wider">Platform Protection</span>
              <div className="text-sm font-black text-emerald-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Supabase RLS Active</span>
              </div>
              <span className="text-[10px] text-slate-400">100% Multi-Tenant Scoped</span>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
              <Lock className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Super Admin Dashboard Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-900 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold w-fit">
          <button
            onClick={() => setActiveTab('SHOPS')}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'SHOPS'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Onboarded Partner Shops ({shops.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('AUDIT_LOGS');
              loadAuditLogs();
            }}
            className={`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 ${
              activeTab === 'AUDIT_LOGS'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Platform Audit Logs ({auditLogs.length})</span>
          </button>
        </div>

        {activeTab === 'SHOPS' ? (
          <>
            {/* Search & Filter Bar */}
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner shop or owner name..."
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl text-xs font-bold w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setPlanFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                planFilter === 'ALL' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Shops ({shops.length})
            </button>
            <button
              onClick={() => setPlanFilter('Professional')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                planFilter === 'Professional' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Professional
            </button>
            <button
              onClick={() => setPlanFilter('Enterprise')}
              className={`px-3.5 py-1.5 rounded-lg transition-all ${
                planFilter === 'Enterprise' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              Enterprise
            </button>
          </div>
        </div>

        {/* Onboarded Partner Shops Directory Table */}
        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-extrabold text-white">Onboarded Jeweler Shops Directory</h3>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{filteredShops.length} Registered Tenants</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Shop Name</th>
                  <th className="py-3.5 px-4">Shop Owner Name</th>
                  <th className="py-3.5 px-4">Mobile & Email</th>
                  <th className="py-3.5 px-4">Subscription Plan</th>
                  <th className="py-3.5 px-4">Account Status</th>
                  <th className="py-3.5 px-4 text-right">Super Admin Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredShops.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500 font-medium">
                      <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40 text-amber-400" />
                      No partner shops match your query. Click "Provision New Shop Owner ID" above.
                    </td>
                  </tr>
                ) : (
                  filteredShops.map((s) => {
                    const isActive = s.is_active !== false;
                    return (
                      <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3.5 px-4 font-black text-white">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold text-xs">
                              {s.shop_name[0]}
                            </div>
                            <span>{s.shop_name}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-extrabold text-slate-200">{s.owner_name}</td>

                        <td className="py-3.5 px-4 text-slate-300 font-medium">
                          <div className="font-mono">{s.mobile}</div>
                          <div className="text-[10px] text-slate-400">{s.email || 'N/A'}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                              s.plan === 'Enterprise'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}
                          >
                            {s.plan}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleStatus(s)}
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold flex items-center gap-1.5 border transition-all ${
                              isActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                            }`}
                          >
                            <Power className="w-3 h-3" />
                            <span>{isActive ? 'Active' : 'Deactivated'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setResetModalShop(s)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 border border-slate-700 transition-colors"
                              title="Reset Password for Shop Owner"
                            >
                              <Key className="w-3.5 h-3.5" />
                              <span>Reset Password</span>
                            </button>

                            <button
                              onClick={() => setDeleteModalShop(s)}
                              className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-bold text-[11px] inline-flex items-center gap-1 border border-rose-500/20 transition-colors"
                              title="Permanently Delete Shop & Owner Account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        </>
        ) : (
          /* Platform Audit Logs Section - Super Admin Dashboard Exclusive */
          <div className="space-y-4">
            <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative w-full md:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder="Search user, shop ID, or table..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl text-xs font-bold w-full md:w-auto overflow-x-auto">
                {['ALL', 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'ACTIVATION_REQUEST'].map((act) => (
                  <button
                    key={act}
                    onClick={() => setAuditActionFilter(act)}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      auditActionFilter === act ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-extrabold text-white">System Audit & Compliance Log Trail</h3>
                </div>
                <span className="text-xs text-slate-400 font-semibold">
                  Showing {auditLogs.filter(l => {
                    const q = auditSearch.toLowerCase();
                    const matchQ = (l.user_name || '').toLowerCase().includes(q) ||
                      (l.table_name || '').toLowerCase().includes(q) ||
                      (l.shop_id || '').toLowerCase().includes(q) ||
                      (l.record_id || '').toLowerCase().includes(q);
                    if (!matchQ) return false;
                    if (auditActionFilter === 'ALL') return true;
                    return l.action === auditActionFilter;
                  }).length} Logs
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-extrabold uppercase tracking-wider">
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Shop ID</th>
                      <th className="py-3.5 px-4">User & Role</th>
                      <th className="py-3.5 px-4">Action</th>
                      <th className="py-3.5 px-4">Module / Table</th>
                      <th className="py-3.5 px-4">Record ID & Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {auditLogs
                      .filter(l => {
                        const q = auditSearch.toLowerCase();
                        const matchQ = (l.user_name || '').toLowerCase().includes(q) ||
                          (l.table_name || '').toLowerCase().includes(q) ||
                          (l.shop_id || '').toLowerCase().includes(q) ||
                          (l.record_id || '').toLowerCase().includes(q);
                        if (!matchQ) return false;
                        if (auditActionFilter === 'ALL') return true;
                        return l.action === auditActionFilter;
                      })
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-slate-800/40 transition-colors text-slate-300">
                          <td className="py-3.5 px-4 text-slate-400 font-mono">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-amber-400">
                            {log.shop_id || 'Global / System'}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-white">
                            {log.user_name || log.user_id || 'System'}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                              log.action === 'CREATE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              log.action === 'UPDATE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              log.action === 'DELETE' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                              'bg-sky-500/10 text-sky-400 border-sky-500/20'
                            }`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-200">
                            {log.table_name}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-mono text-[11px] text-slate-300 max-w-xs truncate">
                              <span className="text-amber-300 font-bold">{log.record_id || '—'}</span>
                              {log.new_data && (
                                <span className="text-slate-400 ml-2">
                                  {JSON.stringify(log.new_data)}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Shop Owner Account Provisioning Modal */}
        {provisionModalOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 text-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-800 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-amber-500 text-slate-950 rounded-xl font-bold">
                    <Plus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Provision New Shop Owner Account</h3>
                    <p className="text-[11px] text-slate-400">Create new jeweler ERP tenant & save directly to Supabase DB</p>
                  </div>
                </div>
                <button
                  onClick={() => setProvisionModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleProvisionShopOwner} className="space-y-4 pt-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Shop ID (Auto-Generated) *</label>
                    <input
                      type="text"
                      value={autoShopId}
                      readOnly
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-amber-400 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Shop / Jeweler Firm Name *</label>
                    <input
                      type="text"
                      required
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder="e.g. Galagidkar Jewellers"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Shop Owner Full Name *</label>
                    <input
                      type="text"
                      required
                      value={ownerName}
                      onChange={(e) => setOwnerName(e.target.value)}
                      placeholder="e.g. Ramesh Galagidkar"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Mobile Phone Number *</label>
                    <input
                      type="text"
                      required
                      value={ownerMobile}
                      onChange={(e) => setOwnerMobile(e.target.value)}
                      placeholder="e.g. 9820098200"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Owner Login Email *</label>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      placeholder="e.g. owner@galagidkar.com"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-semibold text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Set Initial Owner Password *</label>
                    <input
                      type="text"
                      required
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="e.g. password123"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">City *</label>
                    <input
                      type="text"
                      required
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Mumbai"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">State *</label>
                    <input
                      type="text"
                      required
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      placeholder="e.g. Maharashtra"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Pincode *</label>
                    <input
                      type="text"
                      required
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="e.g. 400002"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-300">GSTIN Number (Optional)</label>
                    <input
                      type="text"
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value)}
                      placeholder="e.g. 27AAAAA0000A1Z5"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-slate-300">PAN Number (Optional)</label>
                    <input
                      type="text"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value)}
                      placeholder="e.g. ABCDE1234F"
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Subscription Plan *</label>
                    <select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-amber-400 focus:outline-none focus:border-amber-500"
                    >
                      <option value="Trial">Trial Plan</option>
                      <option value="Monthly">Monthly Plan</option>
                      <option value="Yearly">Yearly Plan</option>
                      <option value="Lifetime">Lifetime Plan</option>
                      <option value="Starter">Starter Plan</option>
                      <option value="Professional">Professional Plan</option>
                      <option value="Enterprise">Enterprise Plan</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Status *</label>
                    <select
                      value={shopStatus}
                      onChange={(e) => setShopStatus(e.target.value as any)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-emerald-400"
                    >
                      <option value="Active">🟢 Active</option>
                      <option value="Inactive">🔴 Inactive</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-extrabold text-amber-300">Opening Date *</label>
                    <input
                      type="date"
                      value={openingDate}
                      onChange={(e) => setOpeningDate(e.target.value)}
                      className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                  <span className="text-[11px] font-black uppercase text-amber-400 tracking-wider block">Initial Gold & Silver Rates & LTV %</span>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">24K Rate (₹/g)</span>
                      <input
                        type="number"
                        value={goldRate24k}
                        onChange={(e) => setGoldRate24k(Number(e.target.value))}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">22K Rate (₹/g)</span>
                      <input
                        type="number"
                        value={goldRate22k}
                        onChange={(e) => setGoldRate22k(Number(e.target.value))}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Silver Rate (₹/kg)</span>
                      <input
                        type="number"
                        value={silverRate1kg}
                        onChange={(e) => setSilverRate1kg(Number(e.target.value))}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-slate-200"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">Max LTV %</span>
                      <input
                        type="number"
                        value={maxLtv}
                        onChange={(e) => setMaxLtv(Number(e.target.value))}
                        className="w-full p-2 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setProvisionModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-xl font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:brightness-105 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{submitting ? 'Saving to Supabase...' : 'Save & Provision Account'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Reset Password Confirmation Modal */}
        {resetModalShop && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-800">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Reset Shop Owner Password</h3>
                  <p className="text-[11px] text-slate-400">Set new password directly for {resetModalShop.owner_name} (No verification required)</p>
                </div>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <div>
                  <label className="text-slate-300 font-bold block mb-1">Target Account Email</label>
                  <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono text-amber-300 font-bold text-xs">
                    {resetModalShop.email || resetModalShop.mobile}
                  </div>
                </div>

                <div>
                  <label className="text-amber-300 font-extrabold block mb-1">Set New Owner Password *</label>
                  <input
                    type="text"
                    value={newDirectPassword}
                    onChange={(e) => setNewDirectPassword(e.target.value)}
                    placeholder="e.g. password123"
                    className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ⚡ Instant update: The password will work immediately for login. Email verification is automatically bypassed.
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setResetModalShop(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleResetPassword(resetModalShop, newDirectPassword)}
                  className="px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 text-slate-950 rounded-xl font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
                >
                  <Key className="w-4 h-4" />
                  <span>Update Password Directly</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permanent Delete Confirmation Modal */}
        {deleteModalShop && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-slate-900 text-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-500/30">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-rose-400">Permanently Delete Shop Owner</h3>
                  <p className="text-[11px] text-slate-400">This action cannot be undone</p>
                </div>
              </div>

              <div className="py-4 space-y-3 text-xs">
                <p className="text-slate-300 font-medium">
                  Are you sure you want to permanently delete <strong className="text-amber-300">{deleteModalShop.shop_name}</strong>?
                </p>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-left space-y-1 font-mono text-[11px]">
                  <div><span className="text-slate-400">Shop ID:</span> <span className="text-white">{deleteModalShop.id}</span></div>
                  <div><span className="text-slate-400">Owner Name:</span> <span className="text-white">{deleteModalShop.owner_name}</span></div>
                  <div><span className="text-slate-400">Mobile:</span> <span className="text-white">{deleteModalShop.mobile}</span></div>
                </div>

                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 font-semibold text-[11px]">
                  ⚠️ Warning: All associated owner login profiles and branch configurations will be removed from Supabase DB.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setDeleteModalShop(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteShop(deleteModalShop)}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-lg shadow-rose-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Permanently Delete</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SuperAdminLayout>
  );
}
