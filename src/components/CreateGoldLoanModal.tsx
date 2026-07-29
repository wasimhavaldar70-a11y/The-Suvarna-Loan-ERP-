'use client';

// ========================================================
// SuvarnaLoan ERP - Create & Disburse Gold Loan Modal (Multi-Ornament Support)
// Location: src/components/CreateGoldLoanModal.tsx
// ========================================================

import React, { useState, useEffect, useRef } from 'react';
import { Coins, X, Calculator, Plus, UserCheck, ShieldCheck, Zap, Search, User, Phone, CheckCircle2, Camera, Users, Trash2, Layers, AlertTriangle, Loader2 } from 'lucide-react';
import { db } from '../lib/supabase/supabaseDb';
import { getSessionUser } from '../lib/supabase/client';
import { Customer, GoldItem } from '../types';
import { calculateGoldValuation } from '../lib/goldValuationEngine';
import { formatCurrency, formatWeight } from '../lib/utils';
import { DocumentCameraUpload } from './ui/DocumentCameraUpload';
import { uploadToSupabaseStorage } from '../lib/storageHelper';
import { generateNextCustomerId } from '../lib/idGenerator';
import { validateFullName, validatePhone, validateAadhaar, validatePanCard, validateStreetAddress } from '../lib/validation';
import { toast } from 'sonner';

interface CreateGoldLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedCustomerId?: string;
}

export interface OrnamentItemInput {
  id: string;
  metalType?: 'Gold' | 'Silver';
  ornamentName: string;
  purity: '24K (99.9%)' | '22K (91.6%)' | '20K (83.3%)' | '18K (75.0%)' | '14K (58.5%)';
  grossWeight: number;
  stoneWeight: number;
  hallmarkNumber?: string;
  lockerNumber?: string;
  photoUrl?: string;
}

export function CreateGoldLoanModal({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
}: CreateGoldLoanModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [existingLoansMap, setExistingLoansMap] = useState<Record<string, any[]>>({});
  const [goldRate24k, setGoldRate24k] = useState<number>(7650);
  const [silverRatePerGram, setSilverRatePerGram] = useState<number>(92);

  // Searchable Customer State
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(preselectedCustomerId || '');

  // Full Register Customer Modal Overlay
  const [registerCustomerModalOpen, setRegisterCustomerModalOpen] = useState(false);

  // Full New Customer Form Fields
  const [newCustName, setNewCustName] = useState('');
  const [newCustMobile, setNewCustMobile] = useState('');
  const [newCustAadhaar, setNewCustAadhaar] = useState('');
  const [newCustPan, setNewCustPan] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // WebP Compressed Document / Photo States for Customer
  const [photoUrl, setPhotoUrl] = useState('');
  const [aadhaarFrontUrl, setAadhaarFrontUrl] = useState('');
  const [aadhaarBackUrl, setAadhaarBackUrl] = useState('');
  const [panUrl, setPanUrl] = useState('');

  const isSavingCustomerRef = useRef(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingCustomerStepText, setSavingCustomerStepText] = useState('Saving Customer...');
  const [savingCustomerSuccess, setSavingCustomerSuccess] = useState(false);
  const [savingCustomerError, setSavingCustomerError] = useState(false);

  const getActiveShopId = () => {
    const session = getSessionUser();
    return session?.user?.shop_id || session?.shop?.id || '';
  };

  const handleKeyDownCustomerForm = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (savingCustomer || isSavingCustomerRef.current)) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const fetchCustomers = async () => {
    const activeShopId = getActiveShopId();
    const list = await db.getCustomers(activeShopId);
    setCustomers(list);

    // Fetch existing active loans for multi-loan portfolio tracking per customer
    const allLoans = await db.getLoans(activeShopId);
    const map: Record<string, any[]> = {};
    allLoans.forEach((l) => {
      if (l.customer_id && l.status !== 'Closed') {
        if (!map[l.customer_id]) map[l.customer_id] = [];
        map[l.customer_id].push(l);
      }
    });
    setExistingLoansMap(map);

    return list;
  };

  // MULTI-ORNAMENT ITEM LIST
  const [ornaments, setOrnaments] = useState<OrnamentItemInput[]>([
    {
      id: '1',
      metalType: 'Gold',
      ornamentName: 'Gold Necklace',
      purity: '22K (91.6%)',
      grossWeight: 25.0,
      stoneWeight: 1.0,
      hallmarkNumber: '',
      lockerNumber: 'LOCKER-A-01',
      photoUrl: '',
    },
  ]);

  // Loan Terms & Repayment Model
  const [loanAmount, setLoanAmount] = useState<number>(125000);
  const [allow80Ltv, setAllow80Ltv] = useState<boolean>(false);
  const [interestRate, setInterestRate] = useState<number>(1.5);
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [repaymentModel, setRepaymentModel] = useState<'Bullet Repayment' | 'Reducing Balance EMI'>('Bullet Repayment');
  const [schemeName, setSchemeName] = useState<any>('Standard Monthly');

  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const activeShopId = getActiveShopId();
      fetchCustomers().then((list) => {
        if (preselectedCustomerId) {
          setSelectedCustomerId(preselectedCustomerId);
          const found = list.find((c) => c.id === preselectedCustomerId);
          if (found) setCustomerSearchQuery(found.full_name);
        } else if (list.length && !selectedCustomerId) {
          setSelectedCustomerId(list[0].id);
          setCustomerSearchQuery(list[0].full_name);
        }
      });

      db.getShop(activeShopId).then((s) => {
        if (s) {
          setGoldRate24k(s.gold_rate_24k || 7650);
          setSilverRatePerGram(92);
        }
      });
    }
  }, [isOpen, preselectedCustomerId]);

  // Click outside to close customer search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const matchingCustomers = customers.filter((c) =>
    c.full_name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    c.mobile_number.includes(customerSearchQuery) ||
    (c.aadhaar_number && c.aadhaar_number.includes(customerSearchQuery))
  );

  const selectedCustomerObj = customers.find((c) => c.id === selectedCustomerId);
  const activeLoansForSelectedCust = selectedCustomerId ? (existingLoansMap[selectedCustomerId] || []) : [];
  const totalActiveAmountForSelectedCust = activeLoansForSelectedCust.reduce((sum, l) => sum + (Number(l.loan_amount) || 0), 0);

  // Compute live multi-item gold & silver valuation
  const itemValuations = ornaments.map((item) =>
    calculateGoldValuation({
      metalType: item.metalType || 'Gold',
      grossWeightGrams: Number(item.grossWeight) || 0,
      stoneWeightGrams: Number(item.stoneWeight) || 0,
      purityKarat: item.purity,
      goldRatePerGram24K: goldRate24k,
      silverRatePerGram: silverRatePerGram,
      ltvPercentage: 75,
    })
  );

  const totalGrossWeight = ornaments.reduce((acc, item) => acc + (Number(item.grossWeight) || 0), 0);
  const totalStoneWeight = ornaments.reduce((acc, item) => acc + (Number(item.stoneWeight) || 0), 0);
  const totalNetWeight = itemValuations.reduce((acc, v) => acc + v.netWeight, 0);
  const totalEstimatedMarketValue = itemValuations.reduce((acc, v) => acc + v.estimatedMarketValue, 0);
  const totalMaxLoanAmount = itemValuations.reduce((acc, v) => acc + v.maxLoanAmount, 0);
  const totalMaxLoanAmount80 = Math.round(totalEstimatedMarketValue * 0.80);
  const currentPermittedMaxCap = allow80Ltv ? totalMaxLoanAmount80 : totalMaxLoanAmount;

  // Auto-suggest loan amount based on active LTV cap when items or checkbox change
  useEffect(() => {
    if (allow80Ltv && totalMaxLoanAmount80 > 0) {
      setLoanAmount(totalMaxLoanAmount80);
    } else if (!allow80Ltv && totalMaxLoanAmount > 0) {
      setLoanAmount(totalMaxLoanAmount);
    }
  }, [totalMaxLoanAmount, totalMaxLoanAmount80, allow80Ltv]);

  // Handlers for Multi-Ornament Item List
  const handleAddOrnament = () => {
    const newId = String(Date.now());
    const lockerIndex = ornaments.length + 1;
    setOrnaments([
      ...ornaments,
      {
        id: newId,
        ornamentName: `Gold Item #${lockerIndex}`,
        purity: '22K (91.6%)',
        grossWeight: 10.0,
        stoneWeight: 0.0,
        hallmarkNumber: '',
        lockerNumber: `LOCKER-A-0${lockerIndex}`,
        photoUrl: '',
      },
    ]);
  };

  const handleRemoveOrnament = (id: string) => {
    if (ornaments.length <= 1) {
      toast.error('At least one gold ornament item is required');
      return;
    }
    setOrnaments(ornaments.filter((item) => item.id !== id));
  };

  const handleUpdateOrnament = (id: string, field: keyof OrnamentItemInput, val: any) => {
    setOrnaments(
      ornaments.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  // Handle Full Customer Save
  const handleSaveFullCustomer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSavingCustomerRef.current || savingCustomer) {
      return;
    }

    isSavingCustomerRef.current = true;
    setSavingCustomer(true);
    setSavingCustomerSuccess(false);
    setSavingCustomerError(false);
    setSavingCustomerStepText('Validating Customer Details...');

    const requestUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      const nameCheck = validateFullName(newCustName, 'Full Customer Name');
      if (!nameCheck.isValid) {
        toast.error(nameCheck.error);
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      const phoneCheck = validatePhone(newCustMobile);
      if (!phoneCheck.isValid) {
        toast.error(phoneCheck.error);
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      if (!newCustAadhaar || !newCustAadhaar.trim()) {
        toast.error('Aadhaar Card Number * is mandatory!');
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      const aadhaarCheck = validateAadhaar(newCustAadhaar);
      if (!aadhaarCheck.isValid) {
        toast.error(aadhaarCheck.error);
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      // Check if customer already exists by Mobile or Aadhaar to prevent duplicate profile creation
      const cleanMobile = newCustMobile.trim();
      const cleanAadhaar = newCustAadhaar.trim();
      const existingCust = customers.find(
        (c) => c.mobile_number === cleanMobile || (cleanAadhaar && c.aadhaar_number && c.aadhaar_number === cleanAadhaar)
      );

      if (existingCust) {
        toast.info(`ℹ️ Customer "${existingCust.full_name}" (${existingCust.mobile_number}) is already registered! Selected existing customer profile for new loan disbursal.`);
        setSelectedCustomerId(existingCust.id);
        setCustomerSearchQuery(existingCust.full_name);
        setRegisterCustomerModalOpen(false);
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      if (newCustPan && newCustPan.trim()) {
        const panCheck = validatePanCard(newCustPan);
        if (!panCheck.isValid) {
          toast.error(panCheck.error);
          isSavingCustomerRef.current = false;
          setSavingCustomer(false);
          return;
        }
      }

      if (!photoUrl) {
        toast.error('Photo Upload * is mandatory!');
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      if (!aadhaarFrontUrl) {
        toast.error('Aadhaar Card Front * is mandatory!');
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      if (!aadhaarBackUrl) {
        toast.error('Aadhaar Card Back * is mandatory!');
        isSavingCustomerRef.current = false;
        setSavingCustomer(false);
        return;
      }

      setSavingCustomerStepText('Compressing KYC & Uploading Files...');
      const activeShopId = getActiveShopId();
      const preGenCustId = await generateNextCustomerId(activeShopId);

      const finalPhotoUrl = photoUrl
        ? await uploadToSupabaseStorage(photoUrl, {
            shopId: activeShopId,
            customerName: newCustName,
            customerId: preGenCustId,
            uniqueId: `photo-${Date.now()}`,
            docType: 'Passport-Photo',
          })
        : '';

      const finalAadhaarFrontUrl = aadhaarFrontUrl
        ? await uploadToSupabaseStorage(aadhaarFrontUrl, {
            shopId: activeShopId,
            customerName: newCustName,
            customerId: preGenCustId,
            uniqueId: `aadhaar-front-${Date.now()}`,
            docType: 'Aadhaar-Card-Front',
          })
        : '';

      const finalAadhaarBackUrl = aadhaarBackUrl
        ? await uploadToSupabaseStorage(aadhaarBackUrl, {
            shopId: activeShopId,
            customerName: newCustName,
            customerId: preGenCustId,
            uniqueId: `aadhaar-back-${Date.now()}`,
            docType: 'Aadhaar-Card-Back',
          })
        : '';

      const finalPanUrl = panUrl
        ? await uploadToSupabaseStorage(panUrl, {
            shopId: activeShopId,
            customerName: newCustName,
            customerId: preGenCustId,
            uniqueId: `pan-${Date.now()}`,
            docType: 'PAN-Card',
          })
        : '';

      setSavingCustomerStepText('Creating Customer Record...');
      const createdCust = await db.createCustomer({
        id: preGenCustId,
        shop_id: getActiveShopId(),
        branch_id: 'branch-001',
        full_name: newCustName,
        mobile_number: newCustMobile,
        aadhaar_number: newCustAadhaar,
        pan_number: newCustPan,
        address: newCustAddress,
        city: 'Mumbai',
        state: 'Maharashtra',
        status: 'Active',
        credit_score: 760,
        photo_url: finalPhotoUrl,
        aadhaar_url: finalAadhaarFrontUrl,
        aadhaar_back_url: finalAadhaarBackUrl,
        pan_url: finalPanUrl,
        request_uuid: requestUuid,
      });

      setSavingCustomerSuccess(true);
      setSavingCustomerStepText('✓ Customer Saved Successfully');
      toast.success(`✓ Customer ${newCustName} saved successfully! Selected for Gold Loan disbursal.`);

      const updatedList = await fetchCustomers();
      setSelectedCustomerId(createdCust.id);
      setCustomerSearchQuery(createdCust.full_name);

      setTimeout(() => {
        setRegisterCustomerModalOpen(false);

        setNewCustName('');
        setNewCustMobile('');
        setNewCustAadhaar('');
        setNewCustPan('');
        setNewCustAddress('');
        setPhotoUrl('');
        setAadhaarFrontUrl('');
        setAadhaarBackUrl('');
        setPanUrl('');
        setSavingCustomerSuccess(false);
        setSavingCustomer(false);
        setSavingCustomerError(false);
        isSavingCustomerRef.current = false;
      }, 700);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || '❌ Unable to Save Customer. Please Try Again.');
      setSavingCustomerError(true);
      setSavingCustomerSuccess(false);
      setSavingCustomer(false);
      isSavingCustomerRef.current = false;
    }
  };

  if (!isOpen) return null;

  const handleSubmitDisburseLoan = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedCustomerId) {
      toast.error('Please select or register a borrower customer');
      return;
    }

    if (!loanAmount || Number(loanAmount) <= 0) {
      toast.error('Sanctioned Loan Amount must be greater than ₹0');
      return;
    }

    if (loanAmount > currentPermittedMaxCap) {
      toast.error(`Sanctioned Loan Amount cannot exceed ${allow80Ltv ? '80%' : '75%'} LTV Cap of ${formatCurrency(currentPermittedMaxCap)}`);
      return;
    }

    if (!ornaments || ornaments.length === 0) {
      toast.error('Please add at least one pledged gold ornament before disbursing loan');
      return;
    }

    setLoading(true);

    try {
      const targetCustomerObj = customers.find((c) => c.id === selectedCustomerId);
      const targetCustomerName = targetCustomerObj?.full_name || 'Borrower-Customer';

      // 1. Create all Pledged Gold Items with Supabase Storage uploads
      const createdGoldItems: GoldItem[] = [];
      let idx = 0;
      for (const item of ornaments) {
        idx++;
        const itemValuation = calculateGoldValuation({
          metalType: item.metalType || 'Gold',
          grossWeightGrams: Number(item.grossWeight) || 0,
          stoneWeightGrams: Number(item.stoneWeight) || 0,
          purityKarat: item.purity,
          goldRatePerGram24K: goldRate24k,
          silverRatePerGram: silverRatePerGram,
          ltvPercentage: 75,
        });

        // Upload Gold Ornament / Vault Picture to Supabase Storage inside same customer folder
        const finalOrnamentPhotoUrl = item.photoUrl
          ? await uploadToSupabaseStorage(item.photoUrl, {
              shopId: getActiveShopId(),
              customerName: targetCustomerName,
              customerId: selectedCustomerId,
              uniqueId: `item-${idx}-${Date.now()}`,
              docType: 'Pledged-Gold-Ornament',
              ornamentDescription: item.ornamentName,
            })
          : '';

        const newGold = await db.createGoldItem({
          customer_id: selectedCustomerId,
          shop_id: getActiveShopId(),
          metal_type: item.metalType || 'Gold',
          ornament_type: item.ornamentName,
          description: `${item.purity} ${item.ornamentName}`,
          gross_weight: Number(item.grossWeight) || 0,
          stone_weight: Number(item.stoneWeight) || 0,
          net_weight: itemValuation.netWeight,
          purity: item.purity as any,
          purity_percentage: itemValuation.purityPercentage,
          hallmark_number: item.hallmarkNumber || `HUID-${Math.floor(100000 + Math.random() * 900000)}`,
          pocket_locker_number: item.lockerNumber || `LOCKER-A-${Math.floor(1 + Math.random() * 30)}`,
          market_value_per_gram: itemValuation.rateAppliedPerGram,
          estimated_value: itemValuation.estimatedMarketValue,
          photo_url: finalOrnamentPhotoUrl,
        });
        createdGoldItems.push(newGold);
      }

      if (createdGoldItems.length === 0) {
        throw new Error('Failed to create pledged gold item records in database');
      }

      // 2. Create Gold Loan contract linked to primary gold item
      const primaryGoldItem = createdGoldItems[0];
      const activeShopId = getActiveShopId();
      const loanNumber = await db.generateNextLoanNumber(activeShopId);

      const loanDateObj = new Date();
      const dueDateObj = new Date();
      dueDateObj.setMonth(loanDateObj.getMonth() + (Number(tenureMonths) || 12));

      await db.createLoan({
        shop_id: getActiveShopId(),
        customer_id: selectedCustomerId,
        gold_item_id: primaryGoldItem.id,
        loan_number: loanNumber,
        loan_amount: loanAmount,
        interest_rate: interestRate,
        tenure_months: tenureMonths,
        scheme_name: schemeName,
        repayment_model: repaymentModel,
        loan_date: loanDateObj.toISOString().split('T')[0],
        due_date: dueDateObj.toISOString().split('T')[0],
        status: 'Active',
      });

      toast.success(`Gold Loan ${loanNumber} disbursed for ${formatCurrency(loanAmount)} (${ornaments.length} gold items pledged)!`);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Disburse gold loan exception:', err);
      toast.error(`Failed to disburse gold loan: ${err?.message || 'Unknown database error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-amber-600">
            <Coins className="w-6 h-6" />
            <div>
              <h3 className="text-base font-bold text-slate-900">Issue & Disburse Gold Loan</h3>
              <p className="text-[11px] text-slate-500 font-medium">Support multiple pledged gold ornaments & combined LTV valuation</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmitDisburseLoan} className="space-y-5 pt-4">
          {/* Section 1: Customer Live Search & Open Registration Form Trigger */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Borrower Customer Selection
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewCustName(customerSearchQuery);
                  setRegisterCustomerModalOpen(true);
                }}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 underline flex items-center gap-1"
              >
                + Register New Customer
              </button>
            </div>

            {/* Live Search Bar Component */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search customer by Name, Mobile Number, or Aadhaar Card #..."
                  value={customerSearchQuery}
                  onFocus={() => setSearchDropdownOpen(true)}
                  onChange={(e) => {
                    setCustomerSearchQuery(e.target.value);
                    setSearchDropdownOpen(true);
                  }}
                  className="w-full pl-9 pr-8 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-2xs"
                />
                {customerSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerSearchQuery('');
                      setSelectedCustomerId('');
                    }}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Dropdown Search Results */}
              {searchDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100">
                  {matchingCustomers.length === 0 ? (
                    <div className="p-3 text-center">
                      <p className="text-xs text-slate-500 mb-2">No matching customer found.</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustName(customerSearchQuery);
                          setSearchDropdownOpen(false);
                          setRegisterCustomerModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold hover:bg-amber-600 shadow-2xs"
                      >
                        + Open Registration Form for "{customerSearchQuery}"
                      </button>
                    </div>
                  ) : (
                    matchingCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomerId(c.id);
                          setCustomerSearchQuery(c.full_name);
                          setSearchDropdownOpen(false);
                        }}
                        className={`p-3 cursor-pointer hover:bg-amber-50/50 flex items-center justify-between transition-colors ${
                          selectedCustomerId === c.id ? 'bg-amber-50 font-bold' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                            {c.photo_url ? (
                              <img src={c.photo_url} alt={c.full_name} className="w-full h-full object-cover" />
                            ) : (
                              c.full_name[0]
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs">{c.full_name}</div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>📱 {c.mobile_number}</span>
                              {c.aadhaar_number && <span>🆔 Aadhaar: {c.aadhaar_number}</span>}
                            </div>
                          </div>
                        </div>
                        {selectedCustomerId === c.id && (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Active Loans Notice Banner for Existing Customer */}
            {selectedCustomerObj && activeLoansForSelectedCust.length > 0 && (
              <div className="mt-3 p-3.5 bg-amber-50/90 border border-amber-300 rounded-xl flex items-start gap-3 shadow-2xs">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 w-full">
                  <div className="flex items-center justify-between font-extrabold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <span>Existing Customer Active Loans Notice</span>
                    </span>
                    <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[11px] font-black border border-amber-300">
                      {activeLoansForSelectedCust.length} Active {activeLoansForSelectedCust.length === 1 ? 'Loan' : 'Loans'}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    <strong>{selectedCustomerObj.full_name}</strong> currently has <strong>{activeLoansForSelectedCust.length} active gold loan(s)</strong> with a total outstanding principal of <strong>{formatCurrency(totalActiveAmountForSelectedCust)}</strong>:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeLoansForSelectedCust.map((l, idx) => (
                      <span
                        key={`${l.id}-${l.loan_number}-${idx}`}
                        className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1.5"
                      >
                        <span className="font-extrabold text-slate-900">{l.loan_number}</span>
                        <span className="text-amber-700">({formatCurrency(l.loan_amount)})</span>
                        <span className="text-[10px] text-slate-500 font-medium">[{l.gold_item?.ornament_type || 'Gold Item'}]</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-amber-700 font-semibold italic border-t border-amber-200/80 pt-1.5">
                    ℹ️ Disbursing this loan will issue an additional active loan linked to <strong>{selectedCustomerObj.full_name}</strong>'s profile without creating duplicate customer profiles.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Pledged Gold Ornaments (MULTIPLE ITEMS SUPPORT) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600" />
                <span>2. Pledged Gold Ornaments ({ornaments.length} {ornaments.length === 1 ? 'Item' : 'Items'})</span>
              </span>
              <button
                type="button"
                onClick={handleAddOrnament}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4 text-amber-700" />
                <span>Add Another Gold Ornament</span>
              </button>
            </div>

            {/* Render Each Gold Ornament Form Card */}
            {ornaments.map((item, index) => (
              <div key={item.id} className="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 space-y-3.5 relative">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <span className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[11px] flex items-center justify-center font-black">
                      {index + 1}
                    </span>
                    <span>Ornament Item #{index + 1}</span>
                  </span>

                  {ornaments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOrnament(item.id)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Item
                    </button>
                  )}
                </div>

                {/* Row 0: Metal Type Selector (Gold vs Silver) */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">Select Metal Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateOrnament(item.id, 'metalType', 'Gold')}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all border ${
                        (item.metalType || 'Gold') === 'Gold'
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>🟡 Gold Collateral</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateOrnament(item.id, 'metalType', 'Silver');
                        if (!item.purity.includes('Silver') && !item.purity.includes('925') && !item.purity.includes('999')) {
                          handleUpdateOrnament(item.id, 'purity', '925 Sterling Silver (92.5%)');
                        }
                      }}
                      className={`py-2 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all border ${
                        item.metalType === 'Silver'
                          ? 'bg-slate-800 text-slate-100 border-slate-900 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>⚪ Silver Collateral</span>
                    </button>
                  </div>
                </div>

                {/* Row 1: Ornament Name & Karat Purity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Ornament Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={item.metalType === 'Silver' ? 'e.g. Silver Payal, Silver Anklet, Silver Coins...' : 'e.g. 22K Gold Necklace, Set of 4 Bangles...'}
                      value={item.ornamentName}
                      onChange={(e) => handleUpdateOrnament(item.id, 'ornamentName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Purity & Quality Grade</label>
                    <select
                      value={item.purity}
                      onChange={(e) => handleUpdateOrnament(item.id, 'purity', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    >
                      {item.metalType === 'Silver' ? (
                        <>
                          <option value="999 Fine Silver (99.9%)">999 Fine Silver (99.9%)</option>
                          <option value="925 Sterling Silver (92.5%)">925 Sterling Silver (92.5%)</option>
                          <option value="900 Coin Silver (90.0%)">900 Coin / Utensil Silver (90.0%)</option>
                          <option value="800 Silver (80.0%)">800 Ornaments Silver (80.0%)</option>
                        </>
                      ) : (
                        <>
                          <option value="22K (91.6%)">22K Standard Hallmark (91.6%)</option>
                          <option value="24K (99.9%)">24K Fine Gold (99.9%)</option>
                          <option value="18K (75.0%)">18K Jewellery Gold (75.0%)</option>
                          <option value="14K (58.5%)">14K Ornament Gold (58.5%)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Row 2: Gross Weight (g) & Stones Deduction (g) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Gross Weight (Grams)</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={item.grossWeight || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                        handleUpdateOrnament(item.id, 'grossWeight', clean ? Number(clean) : 0);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Digits & decimals only</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Stones/Lac Deduction (g)</label>
                    <input
                      type="text"
                      placeholder="0.00"
                      value={item.stoneWeight || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.]/g, '');
                        const parts = val.split('.');
                        const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                        handleUpdateOrnament(item.id, 'stoneWeight', clean ? Number(clean) : 0);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Digits & decimals only</p>
                  </div>
                </div>

                {/* Row 3: Ornament Photo (Camera or Upload) */}
                <div>
                  <DocumentCameraUpload
                    label={`Item #${index + 1} Photo (Camera or Upload)`}
                    value={item.photoUrl}
                    onChange={(url) => handleUpdateOrnament(item.id, 'photoUrl', url)}
                    aspectRatio="card"
                  />
                </div>

                {/* Row 4: Hallmark HUID & Locker # */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Hallmark HUID # (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. HUID-MH-994821"
                      value={item.hallmarkNumber}
                      onChange={(e) => handleUpdateOrnament(item.id, 'hallmarkNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Vault Pocket Locker #</label>
                    <input
                      type="text"
                      value={item.lockerNumber}
                      onChange={(e) => handleUpdateOrnament(item.id, 'lockerNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* COMBINED VALUATION SUMMARY CARD FOR ALL ORNAMENTS */}
            <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 rounded-2xl border-2 border-amber-300/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-amber-950 font-bold border-b border-amber-200 pb-2">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  Combined Valuation Summary ({ornaments.length} Pledged Items)
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 font-extrabold">
                  Total Net Gold: {formatWeight(totalNetWeight)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-medium text-slate-700 pt-1">
                <div>
                  <span className="text-slate-500">Gross Wt:</span>{' '}
                  <strong className="text-slate-900">{formatWeight(totalGrossWeight)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Stones Wt:</span>{' '}
                  <strong className="text-slate-900">{formatWeight(totalStoneWeight)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Market Value:</span>{' '}
                  <strong className="text-slate-900">{formatCurrency(totalEstimatedMarketValue)}</strong>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                    Recommended Max Loan (75% LTV Cap):
                  </span>
                  <span className="text-lg font-black text-amber-700">{formatCurrency(totalMaxLoanAmount)}</span>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pt-2 border-t border-amber-200/60">
                  <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allow80Ltv}
                      onChange={(e) => setAllow80Ltv(e.target.checked)}
                      className="w-4 h-4 text-amber-600 rounded border-amber-300 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-800">Allow Loan up to Max 80%</span>
                  </label>

                  <div className="text-xs font-bold text-slate-700">
                    <span className="text-slate-500 mr-1">Maximum Loan (80%):</span>
                    <span className="font-extrabold text-amber-900">{formatCurrency(totalMaxLoanAmount80)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Loan Terms & Tenure */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              3. Loan Disbursal, Tenure & Interest Terms
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sanctioned Loan Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  max={currentPermittedMaxCap}
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-extrabold text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
                <p className="text-[10px] font-bold text-amber-800 mt-0.5">
                  Max allowed: {formatCurrency(currentPermittedMaxCap)} ({allow80Ltv ? '80% LTV' : '75% LTV'})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Monthly Interest Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={interestRate}
                  onChange={(e) => setInterestRate(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Loan Tenure (Months) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Quick Tenure Selection Pills */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Quick Tenure:</span>
              {[
                { label: '3 Months', value: 3 },
                { label: '6 Months', value: 6 },
                { label: '12 Months (1 Year)', value: 12 },
                { label: '24 Months (2 Years)', value: 24 },
              ].map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setTenureMonths(pill.value)}
                  className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                    tenureMonths === pill.value
                      ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Repayment Model Selector Cards */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-800">
                Select Repayment Model Structure <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Option 1: Bullet Repayment / Gold Loan Model */}
                <div
                  onClick={() => setRepaymentModel('Bullet Repayment')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    repaymentModel === 'Bullet Repayment'
                      ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-400/30'
                      : 'bg-slate-50/60 border-slate-200 hover:border-amber-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                      <span>🟡 Bullet Repayment Gold Loan</span>
                    </span>
                    {repaymentModel === 'Bullet Repayment' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-700" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Traditional Indian Gold Finance (Muthoot/Manappuram style). Borrower pays interest monthly; principal repaid at maturity or before auction.
                  </p>
                </div>

                {/* Option 2: Reducing Balance EMI Loan Model */}
                <div
                  onClick={() => setRepaymentModel('Reducing Balance EMI')}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                    repaymentModel === 'Reducing Balance EMI'
                      ? 'bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-400/30'
                      : 'bg-slate-50/60 border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <span>🟢 Reducing Balance EMI Loan</span>
                    </span>
                    {repaymentModel === 'Reducing Balance EMI' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    Fixed monthly EMI. Interest charged strictly on remaining outstanding principal after each payment; loan closes when principal hits ₹0.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Loan Scheme Type</label>
                <select
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Standard Monthly">Standard Monthly Interest</option>
                  <option value="Bullet Repayment">Bullet Interest at Maturity</option>
                  <option value="Festive Special">Festive Special Scheme</option>
                </select>
              </div>

              {/* Calculated Tenure & Maturity Preview Card */}
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 font-medium text-xs border border-slate-800">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>🗓️ Disbursal Date:</span>
                  <span className="font-bold text-white">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400 text-[11px]">
                  <span>⌛ Maturity / Due Date:</span>
                  <span className="font-extrabold text-amber-300">
                    {(() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + (Number(tenureMonths) || 12));
                      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                    })()}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-800 flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">
                    {repaymentModel === 'Reducing Balance EMI' ? 'Est. Monthly EMI:' : 'Est. Monthly Interest:'}
                  </span>
                  <span className="font-bold text-emerald-400">
                    {repaymentModel === 'Reducing Balance EMI'
                      ? `${formatCurrency(Math.round((loanAmount * (interestRate / 100) * Math.pow(1 + interestRate / 100, tenureMonths)) / (Math.pow(1 + interestRate / 100, tenureMonths) - 1)))} / mo`
                      : `${formatCurrency(Math.round(loanAmount * (interestRate / 100)))} / mo`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl shadow-md gold-glow hover:brightness-105 transition-all flex items-center gap-2"
            >
              <Coins className="w-4 h-4" />
              <span>{loading ? 'Disbursing...' : `Disburse Gold Loan (${ornaments.length} Items)`}</span>
            </button>
          </div>
        </form>
      </div>

      {/* FULL REGISTER NEW BORROWER CUSTOMER MODAL OVERLAY */}
      {registerCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-amber-600">
                <Users className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900">Register New Borrower Customer</h3>
              </div>
              <button
                disabled={savingCustomer}
                onClick={() => {
                  if (!savingCustomer) setRegisterCustomerModalOpen(false);
                }}
                className={`text-slate-400 ${savingCustomer ? 'cursor-not-allowed opacity-40' : 'hover:text-slate-600'}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFullCustomer} onKeyDown={handleKeyDownCustomerForm} className="space-y-5 pt-4">
              {/* Section 1: Basic Details */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  1. BASIC DETAILS
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Full Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Shah (letters only)"
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
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
                      value={newCustMobile}
                      onChange={(e) => setNewCustMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
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
                      value={newCustAadhaar ? newCustAadhaar.replace(/(\d{4})(\d{4})?(\d{4})?/, (_, p1, p2, p3) => [p1, p2, p3].filter(Boolean).join(' ')) : ''}
                      onChange={(e) => setNewCustAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
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
                      value={newCustPan}
                      onChange={(e) => setNewCustPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
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
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    className="w-full min-h-[50px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                  />
                </div>
              </div>

              {/* Section 2: Camera Photo & WebP Documents */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>2. MANDATORY CAMERA PHOTO & KYC DOCUMENTS</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>Auto 90% WebP Compression</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo Upload Mandatory */}
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
                  disabled={savingCustomer}
                  onClick={() => {
                    if (!savingCustomer) setRegisterCustomerModalOpen(false);
                  }}
                  className={`min-h-[44px] px-4 py-2.5 text-xs font-semibold rounded-xl transition-colors focus:ring-2 focus:ring-slate-300 focus:outline-none ${
                    savingCustomer
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  aria-busy={savingCustomer}
                  aria-disabled={savingCustomer}
                  className={`min-h-[44px] px-6 py-2.5 text-xs font-bold rounded-xl shadow-md transition-all focus:ring-2 focus:ring-amber-500 focus:outline-none flex items-center justify-center gap-2 ${
                    savingCustomerSuccess
                      ? 'bg-emerald-600 text-white cursor-not-allowed'
                      : savingCustomerError
                      ? 'bg-rose-600 hover:bg-rose-700 text-white gold-glow'
                      : savingCustomer
                      ? 'bg-amber-600/80 text-white cursor-not-allowed opacity-90'
                      : 'bg-amber-500 text-slate-950 hover:bg-amber-600 gold-glow'
                  }`}
                >
                  {savingCustomer ? (
                    <>
                      {savingCustomerSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-white shrink-0" />
                      )}
                      <span>{savingCustomerStepText}</span>
                    </>
                  ) : savingCustomerError ? (
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
    </div>
  );
}
