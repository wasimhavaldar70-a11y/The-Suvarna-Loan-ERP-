'use client';

// ========================================================
// SuvarnaLoan ERP - Customer Directory & KYC Management
// Location: src/app/dashboard/customers/page.tsx
// ========================================================

import React, { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, ShieldCheck, FileCheck, Phone, MapPin, X, Camera, Zap, Eye, Image as ImageIcon, Coins, Lock, Edit2, Save, CheckCircle2, Download, Loader2 } from 'lucide-react';
import DashboardLayout from '../../../components/DashboardLayout';
import { DocumentCameraUpload } from '../../../components/ui/DocumentCameraUpload';
import { CreateGoldLoanModal } from '../../../components/CreateGoldLoanModal';
import { db } from '../../../lib/supabase/supabaseDb';
import { getSessionUser } from '../../../lib/supabase/client';
import { logAuditEvent } from '../../../lib/auditLog';
import { uploadToSupabaseStorage } from '../../../lib/storageHelper';
import { generateNextCustomerId } from '../../../lib/idGenerator';
import { validateFullName, validatePhone, validateAadhaar, validatePanCard, validateStreetAddress, validateGeoField } from '../../../lib/validation';
import { Customer } from '../../../types';
import { toast } from 'sonner';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [previewDocModal, setPreviewDocModal] = useState<{ title: string; url: string } | null>(null);

  // Customer Submission Locks & Progress State
  const isSubmittingCustomerRef = useRef(false);
  const [submittingCustomer, setSubmittingCustomer] = useState(false);
  const [submittingStepText, setSubmittingStepText] = useState('Saving Customer...');
  const [submittingSuccess, setSubmittingSuccess] = useState(false);
  const [submittingError, setSubmittingError] = useState(false);

  // Customer Profile Detail Modal States
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editableMobile, setEditableMobile] = useState('');
  const [savingMobile, setSavingMobile] = useState(false);

  // Issue Loan modal states for customer card trigger
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [loanTargetCustId, setLoanTargetCustId] = useState('');

  // New customer form text fields
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [pan, setPan] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Mumbai');

  // Document & Photo States (Base64 WebP Data URLs)
  const [photoUrl, setPhotoUrl] = useState('');
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState('');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState('');
  const [panUrl, setPanUrl] = useState('');

  const getActiveShopId = () => {
    const session = getSessionUser();
    return session?.user?.shop_id || session?.shop?.id || '';
  };

  const loadCustomers = async () => {
    setLoading(true);
    const shopId = getActiveShopId();
    const data = await db.getCustomers(shopId);
    setCustomers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleKeyDownForm = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (submittingCustomer || isSubmittingCustomerRef.current)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmittingCustomerRef.current || submittingCustomer) {
      return;
    }

    isSubmittingCustomerRef.current = true;
    setSubmittingCustomer(true);
    setSubmittingSuccess(false);
    setSubmittingError(false);
    setSubmittingStepText('Validating Details...');

    // Generate unique idempotency key for this submission request
    const requestUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const nameCheck = validateFullName(fullName, 'Full Customer Name');
      if (!nameCheck.isValid) {
        toast.error(nameCheck.error);
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      const phoneCheck = validatePhone(mobile);
      if (!phoneCheck.isValid) {
        toast.error(phoneCheck.error);
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      if (!aadhaar || !aadhaar.trim()) {
        toast.error('Aadhaar Card Number * is mandatory!');
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      const aadhaarCheck = validateAadhaar(aadhaar);
      if (!aadhaarCheck.isValid) {
        toast.error(aadhaarCheck.error);
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      if (pan && pan.trim()) {
        const panCheck = validatePanCard(pan);
        if (!panCheck.isValid) {
          toast.error(panCheck.error);
          isSubmittingCustomerRef.current = false;
          setSubmittingCustomer(false);
          return;
        }
      }

      // Check if customer already exists by Mobile or Aadhaar to prevent duplicate profile creation
      const cleanMobile = mobile.trim();
      const cleanAadhaar = aadhaar.trim();
      const existingCust = customers.find(
        (c) => c.mobile_number === cleanMobile || (cleanAadhaar && c.aadhaar_number && c.aadhaar_number === cleanAadhaar)
      );

      if (existingCust) {
        toast.info(`ℹ️ Customer "${existingCust.full_name}" (${existingCust.mobile_number}) is already registered! Opened existing customer profile.`);
        setSelectedCustomer(existingCust);
        setProfileModalOpen(true);
        setAddModalOpen(false);
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      if (!photoUrl) {
        toast.error('Photo Upload * is mandatory!');
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      if (!aadhaarFrontUrl) {
        toast.error('Aadhaar Card Front * is mandatory!');
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      if (!aadhaarBackUrl) {
        toast.error('Aadhaar Card Back * is mandatory!');
        isSubmittingCustomerRef.current = false;
        setSubmittingCustomer(false);
        return;
      }

      setSubmittingStepText('Compressing KYC & Uploading Files...');
      const activeShopId = getActiveShopId();
      const preGenCustId = await generateNextCustomerId(activeShopId);

      const [finalPhotoUrl, finalAadhaarFrontUrl, finalAadhaarBackUrl, finalPanUrl] = await Promise.all([
        photoUrl
          ? uploadToSupabaseStorage(photoUrl, {
              shopId: activeShopId,
              customerName: fullName,
              customerId: preGenCustId,
              uniqueId: `photo-${Date.now()}`,
              docType: 'Passport-Photo',
            })
          : Promise.resolve(''),
        aadhaarFrontUrl
          ? uploadToSupabaseStorage(aadhaarFrontUrl, {
              shopId: activeShopId,
              customerName: fullName,
              customerId: preGenCustId,
              uniqueId: `aadhaar-front-${Date.now()}`,
              docType: 'Aadhaar-Card-Front',
            })
          : Promise.resolve(''),
        aadhaarBackUrl
          ? uploadToSupabaseStorage(aadhaarBackUrl, {
              shopId: activeShopId,
              customerName: fullName,
              customerId: preGenCustId,
              uniqueId: `aadhaar-back-${Date.now()}`,
              docType: 'Aadhaar-Card-Back',
            })
          : Promise.resolve(''),
        panUrl
          ? uploadToSupabaseStorage(panUrl, {
              shopId: activeShopId,
              customerName: fullName,
              customerId: preGenCustId,
              uniqueId: `pan-${Date.now()}`,
              docType: 'PAN-Card',
            })
          : Promise.resolve(''),
      ]);

      setSubmittingStepText('Creating Customer Record...');
      const created = await db.createCustomer({
        id: preGenCustId,
        shop_id: activeShopId,
        branch_id: 'branch-001',
        full_name: fullName,
        mobile_number: mobile,
        aadhaar_number: aadhaar,
        pan_number: pan,
        address,
        city,
        state: 'Maharashtra',
        status: 'Active',
        credit_score: 760,
        photo_url: finalPhotoUrl,
        aadhaar_url: finalAadhaarFrontUrl,
        aadhaar_back_url: finalAadhaarBackUrl,
        pan_url: finalPanUrl,
        request_uuid: requestUuid,
      });

      // Asynchronous audit logging (non-blocking)
      logAuditEvent(
        activeShopId,
        'user-001',
        'Shop Owner',
        'CREATE',
        'Customer Profile',
        created.id,
        null,
        { full_name: fullName, mobile_number: mobile }
      ).catch((err) => console.warn('Background audit log warning:', err));

      // Instant UI State Update
      setCustomers((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setSubmittingSuccess(true);
      setSubmittingStepText('✓ Customer Saved Successfully');
      toast.success(`✓ Customer ${fullName} saved successfully!`);

      setTimeout(() => {
        setAddModalOpen(false);

        // Reset form
        setFullName('');
        setMobile('');
        setAadhaar('');
        setPan('');
        setAddress('');
        setPhotoUrl('');
        setAadhaarFrontUrl('');
        setAadhaarBackUrl('');
        setPanUrl('');
        setSubmittingSuccess(false);
        setSubmittingCustomer(false);
        setSubmittingError(false);
        isSubmittingCustomerRef.current = false;

        loadCustomers();
      }, 700);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "❌ Unable to Save Customer. Please Try Again.");
      setSubmittingError(true);
      setSubmittingSuccess(false);
      setSubmittingCustomer(false);
      isSubmittingCustomerRef.current = false;
    }
  };

  const handleOpenProfile = (customer: Customer) => {
    setSelectedCustomer(customer);
    setEditableMobile(customer.mobile_number);
    setProfileModalOpen(true);
  };

  const handleSaveMobile = async () => {
    if (!selectedCustomer) return;
    if (!editableMobile || editableMobile.trim().length < 8) {
      toast.error("Please enter a valid mobile phone number");
      return;
    }

    setSavingMobile(true);
    try {
      const activeShopId = getActiveShopId();
      await db.updateCustomerMobile(selectedCustomer.id, editableMobile);
      await logAuditEvent(
        activeShopId,
        'user-001',
        'Shop Owner',
        'UPDATE',
        'Customer Mobile Number',
        selectedCustomer.id,
        { old_mobile: selectedCustomer.mobile_number },
        { new_mobile: editableMobile }
      );

      toast.success(`Mobile number updated for ${selectedCustomer.full_name}!`);
      setSelectedCustomer({ ...selectedCustomer, mobile_number: editableMobile });
      loadCustomers();
    } catch (err) {
      toast.error("Failed to update mobile number");
    } finally {
      setSavingMobile(false);
    }
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
      console.error(err);
      toast.error("Failed to download document");
    }
  };

  const filtered = React.useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return customers;
    return customers.filter((c) =>
      (c.full_name && c.full_name.toLowerCase().includes(query)) ||
      (c.mobile_number && c.mobile_number.includes(query)) ||
      (c.aadhaar_number && c.aadhaar_number.includes(query))
    );
  }, [customers, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
              Borrower Customer Directory & KYC
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage customers, live camera photo capture & auto 90% compressed WebP Aadhaar/PAN documents
            </p>
          </div>

          <button
            onClick={() => setAddModalOpen(true)}
            className="px-4 py-2 text-xs font-bold bg-amber-500 text-white rounded-xl shadow-md gold-glow hover:bg-amber-600 flex items-center gap-1.5 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200/80">
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by customer name, mobile, or Aadhaar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-amber-500 font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {loading ? (
              <div className="col-span-full py-8 text-center text-slate-400">Loading customers...</div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400">No customers found.</div>
            ) : (
              filtered.map((c) => (
                <div key={c.id} className="bg-slate-50/50 rounded-2xl border border-slate-200/80 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    {/* Customer Photo Thumbnail */}
                    <div
                      onClick={() => handleOpenProfile(c)}
                      className="w-12 h-12 rounded-full bg-slate-800 border-2 border-amber-400 overflow-hidden shrink-0 flex items-center justify-center font-bold text-amber-300 text-sm cursor-pointer hover:ring-4 hover:ring-amber-400/30 transition-all"
                      title="Click to view & edit customer profile"
                    >
                      {c.photo_url ? (
                        <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover" />
                      ) : (
                        c.full_name[0]
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        onClick={() => handleOpenProfile(c)}
                        className="font-bold text-slate-900 text-sm truncate cursor-pointer hover:text-amber-600 hover:underline transition-colors flex items-center gap-1"
                        title="Click to view & edit customer profile"
                      >
                        <span>{c.full_name}</span>
                        <Eye className="w-3 h-3 text-slate-400 opacity-60" />
                      </h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                        <Phone className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="truncate">{c.mobile_number}</span>
                      </div>
                    </div>

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {c.status}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-slate-600 border-t border-slate-200/60 pt-2.5 font-medium">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Aadhaar #:</span>
                      <span className="font-semibold text-slate-800">{c.aadhaar_number || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">PAN #:</span>
                      <span className="font-semibold text-slate-800">{c.pan_number || 'N/A'}</span>
                    </div>
                  </div>

                  {/* Document Thumbnails Preview Row */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">KYC Docs:</span>
                    {c.aadhaar_url && (
                      <button
                        onClick={() => setPreviewDocModal({ title: `${c.full_name} - Aadhaar Front`, url: c.aadhaar_url! })}
                        className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold rounded-md flex items-center gap-1 transition-colors"
                      >
                        <ImageIcon className="w-3 h-3" /> Aadhaar Front
                      </button>
                    )}
                    {c.aadhaar_back_url && (
                      <button
                        onClick={() => setPreviewDocModal({ title: `${c.full_name} - Aadhaar Back`, url: c.aadhaar_back_url! })}
                        className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-extrabold rounded-md flex items-center gap-1 transition-colors"
                      >
                        <ImageIcon className="w-3 h-3" /> Aadhaar Back
                      </button>
                    )}
                    {c.pan_url && (
                      <button
                        onClick={() => setPreviewDocModal({ title: `${c.full_name} - PAN Card`, url: c.pan_url! })}
                        className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-900 text-[10px] font-extrabold rounded-md flex items-center gap-1 transition-colors"
                      >
                        <ImageIcon className="w-3 h-3" /> PAN Card
                      </button>
                    )}
                  </div>

                  {/* Action Bar: Issue Gold Loan */}
                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setLoanTargetCustId(c.id);
                        setLoanModalOpen(true);
                      }}
                      className="w-full py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs gold-glow transition-all"
                    >
                      <Coins className="w-3.5 h-3.5" />
                      <span>Issue Gold Loan</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Disburse Gold Loan Modal for specific customer */}
      <CreateGoldLoanModal
        isOpen={loanModalOpen}
        onClose={() => setLoanModalOpen(false)}
        preselectedCustomerId={loanTargetCustId}
        onSuccess={loadCustomers}
      />

      {/* Add New Customer Modal with Camera & Auto 90% WebP Compression */}
      {addModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Users className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Register New Borrower Customer</h3>
              </div>
              <button
                disabled={submittingCustomer}
                onClick={() => {
                  if (!submittingCustomer) setAddModalOpen(false);
                }}
                className={`text-slate-400 ${submittingCustomer ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomer} onKeyDown={handleKeyDownForm} className="space-y-5 pt-4">
              {/* Section 1: Personal Information */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  1. Basic Details
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Shah (letters only)"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Mobile Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210 (10 digits)"
                      maxLength={10}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Exactly 10 numeric digits only</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Aadhaar Card Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="XXXX XXXX XXXX (12 digits)"
                      maxLength={14}
                      value={aadhaar ? aadhaar.replace(/(\d{4})(\d{4})?(\d{4})?/, (_, p1, p2, p3) => [p1, p2, p3].filter(Boolean).join(' ')) : ''}
                      onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                      required
                    />
                    <p className="text-[10px] text-amber-700 font-bold mt-0.5">Format: XXXX XXXX XXXX (12 digits)</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">PAN Card Number</label>
                    <input
                      type="text"
                      placeholder="ABCDE1234F"
                      maxLength={10}
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Format: ABCDE1234F (5 letters, 4 digits, 1 letter)</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Residential Address</label>
                  <textarea
                    rows={2}
                    placeholder="Full street address..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full min-h-[50px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                    required
                  />
                </div>
              </div>

              {/* Section 2: Camera Capture & Auto WebP Document Upload */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>2. Mandatory Camera Photo & KYC Documents</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>Auto 90% WebP Compression</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Customer Photo Mandatory */}
                  <DocumentCameraUpload
                    label="Photo Upload *"
                    required={true}
                    value={photoUrl}
                    onChange={setPhotoUrl}
                    aspectRatio="square"
                  />

                  {/* Aadhaar Card Front Mandatory */}
                  <DocumentCameraUpload
                    label="Aadhaar Card Front *"
                    required={true}
                    value={aadhaarFrontUrl}
                    onChange={setAadhaarFrontUrl}
                  />

                  {/* Aadhaar Card Back Mandatory */}
                  <DocumentCameraUpload
                    label="Aadhaar Card Back *"
                    required={true}
                    value={aadhaarBackUrl}
                    onChange={setAadhaarBackUrl}
                  />

                  {/* PAN Card Optional */}
                  <DocumentCameraUpload
                    label="PAN Card (Optional)"
                    required={false}
                    value={panUrl}
                    onChange={setPanUrl}
                  />
                </div>
              </div>

              {/* Form Buttons */}
              <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={submittingCustomer}
                  onClick={() => {
                    if (!submittingCustomer) setAddModalOpen(false);
                  }}
                  className={`min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-xl transition-colors focus:ring-2 focus:ring-slate-300 focus:outline-none ${
                    submittingCustomer
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCustomer}
                  aria-busy={submittingCustomer}
                  aria-disabled={submittingCustomer}
                  className={`min-h-[44px] px-6 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all focus:ring-2 focus:ring-amber-500 focus:outline-none flex items-center justify-center gap-2 ${
                    submittingSuccess
                      ? 'bg-emerald-600 text-white cursor-not-allowed'
                      : submittingError
                      ? 'bg-rose-600 hover:bg-rose-700 text-white gold-glow'
                      : submittingCustomer
                      ? 'bg-amber-600/80 text-white cursor-not-allowed opacity-90'
                      : 'bg-gradient-to-r from-amber-600 to-amber-500 text-white gold-glow hover:brightness-105'
                  }`}
                >
                  {submittingCustomer ? (
                    <>
                      {submittingSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                      )}
                      <span>{submittingStepText}</span>
                    </>
                  ) : submittingError ? (
                    <span>Retry Saving Customer</span>
                  ) : (
                    <span>Save Customer & Compressed KYC</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Image Preview Modal */}
      {previewDocModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-4 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-amber-400">{previewDocModal.title}</h3>
              <button onClick={() => setPreviewDocModal(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="my-4 max-h-[70vh] overflow-hidden rounded-xl flex items-center justify-center bg-black">
              <img src={previewDocModal.url} alt={previewDocModal.title} className="max-h-[65vh] w-auto object-contain" />
            </div>
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => handleDownloadDocument(previewDocModal.url, `${previewDocModal.title.replace(/\s+/g, '_')}.webp`)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-md flex items-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                <span>Download Document File</span>
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
      {/* Customer Profile Detail Modal */}
      {profileModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-amber-400 overflow-hidden shrink-0 flex items-center justify-center font-extrabold text-amber-300 text-base">
                  {selectedCustomer.photo_url ? (
                    <img src={selectedCustomer.photo_url} alt={selectedCustomer.full_name} className="w-full h-full object-cover" />
                  ) : (
                    selectedCustomer.full_name[0]
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">{selectedCustomer.full_name}</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {selectedCustomer.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-semibold">
                    KYC Verified • Registered on {new Date(selectedCustomer.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <button onClick={() => setProfileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Fields & Security Lock Warning */}
            <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl text-amber-950 text-xs font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                KYC Security Policy: Customer Name, Aadhaar & PAN details are <strong>🔒 Locked & Non-Editable</strong>. Only <strong>Mobile Number ✏️</strong> can be updated below.
              </span>
            </div>

            <div className="space-y-4 text-xs">
              {/* EDITABLE FIELD: Mobile Phone Number */}
              <div className="p-4 bg-slate-900 text-white rounded-2xl space-y-2 border border-slate-800 shadow-md">
                <label className="block text-xs font-bold text-amber-400 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Phone className="w-4 h-4 text-amber-400" />
                    <span>Mobile Phone Number (EDITABLE ✏️)</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Shop Owner Edit Access</span>
                </label>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    value={editableMobile}
                    onChange={(e) => setEditableMobile(e.target.value)}
                    className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm font-extrabold text-emerald-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="+91 98XXX XXXXX"
                  />
                  <button
                    type="button"
                    onClick={handleSaveMobile}
                    disabled={savingMobile}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 shadow-md gold-glow"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingMobile ? 'Saving...' : 'Save Mobile'}</span>
                  </button>
                </div>
              </div>

              {/* LOCKED FIELDS GRID */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Full Name */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between text-slate-400 font-bold mb-1">
                    <span>Full Customer Name</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <strong className="text-slate-900 text-sm">{selectedCustomer.full_name}</strong>
                </div>

                {/* Aadhaar Number */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between text-slate-400 font-bold mb-1">
                    <span>Aadhaar Card #</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <strong className="text-slate-900 text-sm">{selectedCustomer.aadhaar_number || 'N/A'}</strong>
                </div>

                {/* PAN Number */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex justify-between text-slate-400 font-bold mb-1">
                    <span>PAN Card #</span>
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <strong className="text-slate-900 text-sm">{selectedCustomer.pan_number || 'N/A'}</strong>
                </div>
              </div>

              {/* Address */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="flex justify-between text-slate-400 font-bold">
                  <span>Residential Address</span>
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <p className="text-slate-800 font-semibold">{selectedCustomer.address || 'Address on file'}, {selectedCustomer.city || 'Mumbai'}</p>
              </div>

              {/* Uploaded WebP KYC Documents Section */}
              <div className="space-y-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
                  Uploaded WebP Compressed KYC Documents & Photo
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Document 1: Passport Photograph */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-amber-600" />
                        <span>Passport Size Photograph</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">WebP 90%</span>
                    </div>

                    {selectedCustomer.photo_url ? (
                      <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={selectedCustomer.photo_url} alt="Passport Photo" className="h-full w-auto object-cover" />
                      </div>
                    ) : (
                      <div className="h-28 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium">
                        No photo captured
                      </div>
                    )}

                    {selectedCustomer.photo_url && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: `${selectedCustomer.full_name} Passport Photo`, url: selectedCustomer.photo_url! })}
                          className="py-1.5 px-2 bg-white border border-slate-200 hover:border-amber-400 text-slate-700 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(selectedCustomer.photo_url!, `${selectedCustomer.full_name.replace(/\s+/g, '_')}_Photo.webp`)}
                          className="py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Document 2: Aadhaar Card Front */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Aadhaar Card (Front)</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">WebP 90%</span>
                    </div>

                    {selectedCustomer.aadhaar_url ? (
                      <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={selectedCustomer.aadhaar_url} alt="Aadhaar Front" className="h-full w-auto object-cover" />
                      </div>
                    ) : (
                      <div className="h-28 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium">
                        No document uploaded
                      </div>
                    )}

                    {selectedCustomer.aadhaar_url && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: `${selectedCustomer.full_name} Aadhaar Front`, url: selectedCustomer.aadhaar_url! })}
                          className="py-1.5 px-2 bg-white border border-slate-200 hover:border-amber-400 text-slate-700 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(selectedCustomer.aadhaar_url!, `${selectedCustomer.full_name.replace(/\s+/g, '_')}_Aadhaar_Front.webp`)}
                          className="py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Document 3: Aadhaar Card Back */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>Aadhaar Card (Back)</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">WebP 90%</span>
                    </div>

                    {selectedCustomer.aadhaar_back_url ? (
                      <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={selectedCustomer.aadhaar_back_url} alt="Aadhaar Back" className="h-full w-auto object-cover" />
                      </div>
                    ) : (
                      <div className="h-28 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium">
                        No document uploaded
                      </div>
                    )}

                    {selectedCustomer.aadhaar_back_url && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: `${selectedCustomer.full_name} Aadhaar Back`, url: selectedCustomer.aadhaar_back_url! })}
                          className="py-1.5 px-2 bg-white border border-slate-200 hover:border-amber-400 text-slate-700 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(selectedCustomer.aadhaar_back_url!, `${selectedCustomer.full_name.replace(/\s+/g, '_')}_Aadhaar_Back.webp`)}
                          className="py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Document 4: PAN Card */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <FileCheck className="w-3.5 h-3.5 text-amber-600" />
                        <span>PAN Card</span>
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[9px] font-black">WebP 90%</span>
                    </div>

                    {selectedCustomer.pan_url ? (
                      <div className="h-28 bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center">
                        <img src={selectedCustomer.pan_url} alt="PAN Card" className="h-full w-auto object-cover" />
                      </div>
                    ) : (
                      <div className="h-28 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs font-medium">
                        No document uploaded
                      </div>
                    )}

                    {selectedCustomer.pan_url && (
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDocModal({ title: `${selectedCustomer.full_name} PAN Card`, url: selectedCustomer.pan_url! })}
                          className="py-1.5 px-2 bg-white border border-slate-200 hover:border-amber-400 text-slate-700 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-amber-600" />
                          <span>View</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadDocument(selectedCustomer.pan_url!, `${selectedCustomer.full_name.replace(/\s+/g, '_')}_PAN_Card.webp`)}
                          className="py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 shadow-2xs"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setProfileModalOpen(false);
                  setLoanTargetCustId(selectedCustomer.id);
                  setLoanModalOpen(true);
                }}
                className="px-4 py-2 text-xs font-bold bg-amber-500 text-slate-950 rounded-xl shadow-md gold-glow hover:bg-amber-600 flex items-center gap-1.5"
              >
                <Coins className="w-4 h-4" />
                <span>Issue Gold Loan to {selectedCustomer.full_name.split(' ')[0]}</span>
              </button>

              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
