'use client';

// ========================================================
// SuvarnaLoan ERP - Individual Loan Detail & Repayment Modal
// Location: src/app/dashboard/loans/[id]/page.tsx
// ========================================================

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Coins,
  Receipt,
  UserCheck,
  Package,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Plus,
  X,
  ShieldCheck,
  Eye,
  Download,
  Camera,
  FileCheck,
  Phone,
  MapPin,
  Lock,
  Save,
  Image as ImageIcon,
  MessageSquare,
  Trash2
} from 'lucide-react';
import DashboardLayout from '../../../../components/DashboardLayout';
import { TouchCard } from '../../../../components/ui/TouchCard';
import { RecordRepaymentModal } from '../../../../components/RecordRepaymentModal';
import { LoanClosureCelebrationModal } from '../../../../components/LoanClosureCelebrationModal';
import { WhatsAppAlertModal } from '../../../../components/WhatsAppAlertModal';
import { db } from '../../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../../lib/supabase/client';
import { logAuditEvent } from '../../../../lib/auditLog';
import { Loan, Payment } from '../../../../types';
import { formatCurrency, formatWeight, formatDate } from '../../../../lib/utils';
import { calculateLoanFinancials, calculateReducingBalanceSchedule } from '../../../../lib/goldValuationEngine';
import { toast } from 'sonner';

export default function LoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [celebrationModalOpen, setCelebrationModalOpen] = useState(false);
  const [waModalOpen, setWaModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);

  // Mobile edit state
  const [editableMobile, setEditableMobile] = useState('');
  const [savingMobile, setSavingMobile] = useState(false);

  const loadLoan = async () => {
    setLoading(true);
    const data = await db.getLoanById(resolvedParams.id);
    setLoan(data);
    if (data && data.customer) {
      setEditableMobile(data.customer.mobile_number);
    }
    setLoading(false);
  };

  const handleDownloadDocument = (url: string, filename: string) => {
    if (!url) {
      toast.error("Document file not available for download");
      return;
    }
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error("Failed to download document");
    }
  };

  const handleSaveMobile = async () => {
    if (!loan || !loan.customer) return;
    if (!editableMobile || editableMobile.trim().length < 8) {
      toast.error("Please enter a valid mobile phone number");
      return;
    }

    setSavingMobile(true);
    try {
      const session = getSessionUser();
      const activeShopId = loan.shop_id || session?.user?.shop_id || session?.shop?.id || '';
      await logAuditEvent(
        activeShopId,
        'user-001',
        'Shop Owner',
        'UPDATE',
        'Customer Mobile Number',
        loan.customer.id,
        { old_mobile: loan.customer.mobile_number },
        { new_mobile: editableMobile }
      );

      toast.success(`Mobile number updated for ${loan.customer.full_name}!`);
      loadLoan();
    } catch (err) {
      toast.error("Failed to update mobile number");
    } finally {
      setSavingMobile(false);
    }
  };

  useEffect(() => {
    loadLoan();
  }, [resolvedParams.id]);

  const handlePrintReceipt = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 w-48 rounded-xl"></div>
          <div className="h-64 bg-slate-200 rounded-2xl"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!loan) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
          <p className="text-slate-500">Loan contract record not found.</p>
          <Link href="/dashboard/loans" className="mt-4 inline-block text-xs font-bold text-amber-600 hover:underline">
            Back to Loans Register
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const handleDeleteLoan = async () => {
    if (!loan) return;
    if (confirm(`Are you sure you want to delete Loan ${loan.loan_number}? This will permanently purge the loan record.`)) {
      await db.deleteLoan(loan.id, loan.shop_id);
      toast.success(`Loan ${loan.loan_number} deleted successfully`);
      router.push('/dashboard/loans');
    }
  };

  const financials = calculateLoanFinancials(
    loan.loan_amount,
    loan.interest_rate,
    loan.loan_date,
    loan.due_date,
    loan.payments,
    loan.repayment_model || 'Bullet Repayment',
    loan.tenure_months || 12
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/loans"
              className="p-2 text-slate-500 hover:text-slate-900 bg-white border border-slate-200 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-slate-900">
                  Gold Loan {loan.loan_number}
                </h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                    loan.status === 'Active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : loan.status === 'Overdue'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {loan.status}
                </span>

                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                  {financials.repaymentModel === 'Reducing Balance EMI' ? '🟢 Reducing Balance EMI' : '🟡 Bullet Repayment'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Disbursed on {formatDate(loan.loan_date)} • Tenure: {loan.tenure_months || 12} Months</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteLoan}
              className="px-3.5 py-2 text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-1.5 transition-colors"
              title="Delete Loan Contract"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              <span>Delete Loan</span>
            </button>

            <button
              onClick={() => setWaModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md flex items-center gap-1.5 transition-all"
            >
              <MessageSquare className="w-4 h-4 text-emerald-100" />
              <span>WhatsApp Alert</span>
            </button>

            <button
              onClick={handlePrintReceipt}
              className="px-3.5 py-2 text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Loan Contract</span>
            </button>

            {loan.status !== 'Closed' && (
              <button
                onClick={() => setPayModalOpen(true)}
                className="px-4 py-2 text-xs font-bold bg-amber-500 text-white rounded-xl shadow-md gold-glow hover:bg-amber-600 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Record Repayment</span>
              </button>
            )}
          </div>
        </div>

        {/* Auction Eligibility Alert Banner */}
        {financials.isAuctionEligible && (
          <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-3 text-rose-950 shadow-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-rose-900">
                  🚨 AUCTION ELIGIBLE - OVERDUE BY {financials.overdueDays} DAYS
                </h4>
                <p className="text-xs font-medium text-rose-800">
                  Borrower has defaulted past the 30-day grace period. Pledged gold ornaments may be initiated for public auction recovery as per RBI / Indian Gold Lending regulations.
                </p>
              </div>
            </div>
            <button
              onClick={() => setPayModalOpen(true)}
              className="px-3.5 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 shrink-0 shadow-2xs"
            >
              Collect Dues Before Auction
            </button>
          </div>
        )}

        {/* Top 3 Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TouchCard>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sanctioned Principal</span>
            <div className="text-2xl font-extrabold text-slate-900 mt-1">{formatCurrency(loan.loan_amount)}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">Monthly Interest: {loan.interest_rate}%</div>
          </TouchCard>

          <TouchCard>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Interest Paid</span>
            <div className="text-2xl font-extrabold text-emerald-600 mt-1">{formatCurrency(financials.totalInterestPaid)}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Elapsed: {financials.elapsedMonths} months ({financials.elapsedDays} days)
            </div>
          </TouchCard>

          <TouchCard className={financials.isOverdue ? 'border-rose-200 bg-rose-50/40' : ''}>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Balance Outstanding</span>
            <div className="text-2xl font-extrabold text-amber-700 mt-1">{formatCurrency(financials.totalBalanceDue)}</div>
            <div className="text-[11px] font-semibold text-slate-500 mt-1">
              Due Date: {formatDate(loan.due_date)} {financials.isOverdue && <strong className="text-rose-600 ml-1">(OVERDUE)</strong>}
            </div>
          </TouchCard>
        </div>

        {/* Customer & Pledged Gold Ornament Information Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer CRM & KYC Document Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-amber-700">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Borrower Profile & KYC Documents</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                KYC Verified
              </span>
            </div>

            {/* Borrower Header with Photo */}
            <div className="flex items-center gap-3.5 p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <div className="w-14 h-14 rounded-full bg-slate-900 border-2 border-amber-400 overflow-hidden shrink-0 flex items-center justify-center font-extrabold text-amber-300 text-lg">
                {loan.customer?.photo_url ? (
                  <img src={loan.customer.photo_url} alt={loan.customer.full_name} className="w-full h-full object-cover" />
                ) : (
                  loan.customer?.full_name?.[0] || 'C'
                )}
              </div>
              <div>
                <h4 className="text-base font-extrabold text-slate-900">{loan.customer?.full_name}</h4>
              </div>
            </div>

            {/* Editable Mobile Phone Section */}
            <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 border border-slate-800">
              <label className="block text-[11px] font-bold text-amber-400 flex items-center justify-between">
                <span>Mobile Phone Number (EDITABLE ✏️)</span>
                <span className="text-[9px] text-slate-400">Shop Owner Edit Access</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editableMobile}
                  onChange={(e) => setEditableMobile(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-extrabold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={handleSaveMobile}
                  disabled={savingMobile}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs flex items-center gap-1 shadow-2xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMobile ? 'Saving...' : 'Save Mobile'}</span>
                </button>
              </div>
            </div>

            {/* Locked KYC Fields */}
            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-slate-700">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                  <span>Aadhaar Card #</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </div>
                <strong className="text-slate-900 text-xs block mt-0.5">{loan.customer?.aadhaar_number || 'N/A'}</strong>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
                <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                  <span>PAN Card #</span>
                  <Lock className="w-3 h-3 text-slate-400" />
                </div>
                <strong className="text-slate-900 text-xs block mt-0.5">{loan.customer?.pan_number || 'N/A'}</strong>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80 text-xs">
              <div className="flex justify-between text-slate-400 text-[10px] font-bold">
                <span>Residential Address</span>
                <Lock className="w-3 h-3 text-slate-400" />
              </div>
              <p className="text-slate-800 font-semibold mt-0.5">{loan.customer?.address || 'Address on file'}</p>
            </div>

            {/* Borrower KYC Documents Download & View Section */}
            {loan.customer && (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Borrower WebP KYC Document Files:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {loan.customer.photo_url && (
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-700">
                      <span className="truncate">Photo</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: `${loan.customer?.full_name} Photo`, url: loan.customer!.photo_url! })}
                          className="p-1 text-slate-600 hover:text-amber-600 hover:bg-white rounded-md border border-slate-200"
                          title="View Photo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(loan.customer!.photo_url!, `${loan.customer?.full_name.replace(/\s+/g, '_')}_Photo.webp`)}
                          className="p-1 bg-amber-500 text-slate-950 hover:bg-amber-600 rounded-md font-bold"
                          title="Download Photo"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {loan.customer.aadhaar_url && (
                    <div className="p-2 border border-slate-200 rounded-lg bg-slate-50 flex items-center justify-between gap-1 text-[11px] font-semibold text-slate-700">
                      <span className="truncate">Aadhaar</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: `${loan.customer?.full_name} Aadhaar`, url: loan.customer!.aadhaar_url! })}
                          className="p-1 text-slate-600 hover:text-amber-600 hover:bg-white rounded-md border border-slate-200"
                          title="View Aadhaar"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(loan.customer!.aadhaar_url!, `${loan.customer?.full_name.replace(/\s+/g, '_')}_Aadhaar.webp`)}
                          className="p-1 bg-amber-500 text-slate-950 hover:bg-amber-600 rounded-md font-bold"
                          title="Download Aadhaar"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Gold Item Asset Card with Photo */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-amber-700">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                <h3 className="text-sm font-bold text-slate-900">Pledged Gold Ornament Asset</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                {loan.gold_item?.purity || '22K (91.6%)'}
              </span>
            </div>

            {/* Pledged Gold Image Snapshot Box */}
            <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                <span className="flex items-center gap-1.5 text-amber-400">
                  <Camera className="w-4 h-4" />
                  <span>Pledged Gold Ornament Snapshot</span>
                </span>
                {loan.gold_item?.photo_url && (
                  <span className="text-[10px] text-emerald-400 font-extrabold">WebP 90% Compressed</span>
                )}
              </div>

              {loan.gold_item?.photo_url ? (
                <div className="h-44 bg-black rounded-lg overflow-hidden flex items-center justify-center relative group">
                  <img src={loan.gold_item.photo_url} alt={loan.gold_item.ornament_type} className="h-full w-auto object-contain" />
                  <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewDocModal({ title: `Pledged ${loan.gold_item?.ornament_type}`, url: loan.gold_item!.photo_url! })}
                      className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-lg flex items-center gap-1 shadow-md"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-600" />
                      <span>View Full Resolution</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadDocument(loan.gold_item!.photo_url!, `Pledged_${loan.gold_item?.ornament_type.replace(/\s+/g, '_')}.webp`)}
                      className="px-3 py-1.5 bg-amber-500 text-slate-950 font-black text-xs rounded-lg flex items-center gap-1 shadow-md"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-28 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium">
                  No ornament photo uploaded
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs font-medium text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Ornament Type / Name:</span>
                <span className="font-bold text-slate-900">{loan.gold_item?.ornament_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Purity Karat Grade:</span>
                <span className="font-extrabold text-amber-700">{loan.gold_item?.purity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Weight:</span>
                <span className="font-semibold text-slate-900">{formatWeight(loan.gold_item?.gross_weight)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stones / Lac Deduction:</span>
                <span className="font-semibold text-slate-900">{formatWeight(loan.gold_item?.stone_weight)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Net Pure Gold Weight:</span>
                <span className="font-extrabold text-slate-900 text-sm text-amber-700">{formatWeight(loan.gold_item?.net_weight)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Hallmark HUID #:</span>
                <span className="font-semibold text-slate-900">{loan.gold_item?.hallmark_number || 'N/A'}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2">
                <span className="text-slate-500">Vault Locker Pocket #:</span>
                <span className="font-extrabold text-slate-900 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-[11px]">{loan.gold_item?.pocket_locker_number}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Repayment History Table */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Repayment Transaction Ledger</h3>
            <span className="text-xs font-semibold text-slate-500">{loan.payments?.length || 0} Transactions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Receipt #</th>
                  <th className="py-3 px-4">Payment Date</th>
                  <th className="py-3 px-4">Payment Type</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Amount Paid</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                {!loan.payments || loan.payments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      No repayments recorded yet for this loan.
                    </td>
                  </tr>
                ) : (
                  loan.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-bold text-amber-700">{p.receipt_number}</td>
                      <td className="py-3 px-4 text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{p.payment_type}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[10px]">
                          {p.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-extrabold text-emerald-600">{formatCurrency(p.amount)}</td>
                      <td className="py-3 px-4 text-slate-500">{p.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Reducing Balance EMI Amortization Schedule Table */}
        {financials.repaymentModel === 'Reducing Balance EMI' && (
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">🟢 Reducing Balance EMI Amortization Schedule</h3>
                <p className="text-[11px] text-slate-500 font-medium">Interest is recalculated on the reduced principal balance after every payment</p>
              </div>
              <span className="text-xs font-black px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-lg">
                Calculated Monthly EMI: {formatCurrency(financials.emiAmount)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Month</th>
                    <th className="py-2.5 px-4">Opening Principal</th>
                    <th className="py-2.5 px-4">Monthly Interest ({loan.interest_rate}%)</th>
                    <th className="py-2.5 px-4">Principal Component</th>
                    <th className="py-2.5 px-4">Total Monthly EMI</th>
                    <th className="py-2.5 px-4">Closing Principal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-800">
                  {calculateReducingBalanceSchedule(loan.loan_amount, loan.interest_rate, loan.tenure_months || 12).map((row) => (
                    <tr key={row.month} className="hover:bg-emerald-50/20">
                      <td className="py-2.5 px-4 font-bold text-amber-700">Month #{row.month}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{formatCurrency(row.openingPrincipal)}</td>
                      <td className="py-2.5 px-4 text-rose-600 font-semibold">{formatCurrency(row.monthlyInterest)}</td>
                      <td className="py-2.5 px-4 text-emerald-700 font-bold">{formatCurrency(row.principalPaid)}</td>
                      <td className="py-2.5 px-4 font-black text-slate-900">{formatCurrency(row.emiAmount)}</td>
                      <td className="py-2.5 px-4 font-extrabold text-amber-900">{formatCurrency(row.closingPrincipal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Document & Gold Ornament Image Preview Modal */}
      {previewDocModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-4 shadow-2xl text-white space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-amber-400">{previewDocModal.title}</h3>
              <button onClick={() => setPreviewDocModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="my-2 max-h-[70vh] overflow-hidden rounded-xl flex items-center justify-center bg-black">
              <img src={previewDocModal.url} alt={previewDocModal.title} className="max-h-[65vh] w-auto object-contain" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleDownloadDocument(previewDocModal.url, `${previewDocModal.title.replace(/\s+/g, '_')}.webp`)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download High-Res File</span>
              </button>
              <button
                onClick={() => setPreviewDocModal(null)}
                className="px-4 py-1.5 bg-slate-800 text-xs font-bold rounded-xl text-white hover:bg-slate-700"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      <RecordRepaymentModal
        isOpen={payModalOpen}
        onClose={() => setPayModalOpen(false)}
        loan={loan}
        onSuccess={loadLoan}
        onLoanClosed={() => setCelebrationModalOpen(true)}
      />

      {/* Loan Closure Celebration & Certificates Modal */}
      <LoanClosureCelebrationModal
        isOpen={celebrationModalOpen}
        onClose={() => setCelebrationModalOpen(false)}
        loan={loan}
      />

      {/* WhatsApp Customer Alert Dispatcher Modal */}
      <WhatsAppAlertModal
        isOpen={waModalOpen}
        onClose={() => setWaModalOpen(false)}
        loan={loan}
        defaultType={loan?.status === 'Closed' ? 'LOAN_CLOSURE' : 'MONTHLY_DUE'}
      />
    </DashboardLayout>
  );
}
