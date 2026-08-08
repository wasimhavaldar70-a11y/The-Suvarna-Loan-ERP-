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
import { useTranslation } from '../providers/LanguageProvider';

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
  grossWeight: number | string;
  stoneWeight: number | string;
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
  const { dict, language, isMarathi } = useTranslation();
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
      grossWeight: '',
      stoneWeight: '',
      hallmarkNumber: '',
      lockerNumber: 'LOCKER-A-01',
      photoUrl: '',
    },
  ]);

  // Loan Terms & Repayment Model
  const [loanAmount, setLoanAmount] = useState<number>(125000);
  const [isCustomLoanAmount, setIsCustomLoanAmount] = useState<boolean>(false);
  const [disbursalStrategy, setDisbursalStrategy] = useState<'LTV_75' | 'LTV_80' | 'FULL_100' | 'CUSTOM_OVER_VALUATION'>('LTV_75');
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

      const syncRates = () => {
        db.getShopGoldRates(activeShopId).then((rates) => {
          setGoldRate24k(rates.gold24k);
          setSilverRatePerGram(rates.silverPerGram);
        });
      };

      syncRates();

      const handleRealtimeUpdate = (e: any) => {
        if (!e.detail?.table || e.detail.table === 'shops') {
          syncRates();
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
        window.addEventListener('suvarnaloan-db-update', syncRates);
      }

      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('suvarnaloan-realtime-update', handleRealtimeUpdate);
          window.removeEventListener('suvarnaloan-db-update', syncRates);
        }
      };
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

  // Auto-suggest loan amount based on active LTV cap when items or checkbox change (if not manually customized)
  useEffect(() => {
    if (!isCustomLoanAmount) {
      if (allow80Ltv && totalMaxLoanAmount80 > 0) {
        setLoanAmount(totalMaxLoanAmount80);
      } else if (!allow80Ltv && totalMaxLoanAmount > 0) {
        setLoanAmount(totalMaxLoanAmount);
      }
    }
  }, [totalMaxLoanAmount, totalMaxLoanAmount80, allow80Ltv, isCustomLoanAmount]);

  // Handlers for Multi-Ornament Item List
  const handleAddOrnament = () => {
    const newId = String(Date.now());
    const lockerIndex = ornaments.length + 1;
    setOrnaments([
      ...ornaments,
      {
        id: newId,
        metalType: 'Gold',
        ornamentName: `Gold Item #${lockerIndex}`,
        purity: '22K (91.6%)',
        grossWeight: '',
        stoneWeight: '',
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

    // Enforce LTV cap check only when adhering strictly to standard 75%/80% LTV modes without custom override
    if (!isCustomLoanAmount && disbursalStrategy !== 'CUSTOM_OVER_VALUATION' && loanAmount > currentPermittedMaxCap) {
      toast.error(`Sanctioned Loan Amount cannot exceed ${allow80Ltv ? '80%' : '75%'} LTV Cap of ${formatCurrency(currentPermittedMaxCap)}`);
      return;
    }

    if (!ornaments || ornaments.length === 0) {
      toast.error(isMarathi ? 'कृपया कर्ज वितरणापूर्वी किमान एक तारण सोन्याचा दागिना जोडा' : 'Please add at least one pledged gold ornament before disbursing loan');
      return;
    }

    // Comprehensive Weight Validation
    for (let i = 0; i < ornaments.length; i++) {
      const item = ornaments[i];
      const gWeight = Number(item.grossWeight);
      const sWeight = Number(item.stoneWeight) || 0;
      if (item.grossWeight === '' || item.grossWeight === undefined || isNaN(gWeight) || gWeight <= 0) {
        toast.error(
          isMarathi
            ? `कृपया दागिना #${i + 1} साठी किमान ०.००१ ग्रॅम स्थूल वजन प्रविष्ट करा`
            : `Please enter a valid gross weight greater than 0 grams for Item #${i + 1}`
        );
        return;
      }
      if (sWeight < 0 || sWeight >= gWeight) {
        toast.error(
          isMarathi
            ? `दागिना #${i + 1} चे खडे वजावट वजन (${sWeight}g) स्थूल वजनापेक्षा (${gWeight}g) कमी असणे आवश्यक आहे`
            : `Stone deduction for Item #${i + 1} (${sWeight}g) must be less than gross weight (${gWeight}g)`
        );
        return;
      }
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
              <h3 className="text-base font-bold text-slate-900">{dict.loan.issueLoanModalTitle}</h3>
              <p className="text-[11px] text-slate-500 font-medium">{dict.loan.issueLoanSubtitle}</p>
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
                {dict.loan.borrowerSelection}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNewCustName(customerSearchQuery);
                  setRegisterCustomerModalOpen(true);
                }}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 underline flex items-center gap-1"
              >
                {dict.customer.addCustomer}
              </button>
            </div>

            {/* Live Search Bar Component */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder={isMarathi ? 'ग्राहक नाव, मोबाईल किंवा आधार क्र. शोधा...' : 'Search customer by Name, Mobile Number, or Aadhaar Card #...'}
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
                      <p className="text-xs text-slate-500 mb-2">{dict.common.noRecords}</p>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustName(customerSearchQuery);
                          setSearchDropdownOpen(false);
                          setRegisterCustomerModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold hover:bg-amber-600 shadow-2xs"
                      >
                        {isMarathi
                          ? `"${customerSearchQuery}" साठी नवीन ग्राहक नोंदणी फॉर्म उघडा`
                          : `+ Open Registration Form for "${customerSearchQuery}"`}
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
                              {c.aadhaar_number && <span>🆔 {isMarathi ? 'आधार' : 'Aadhaar'}: {c.aadhaar_number}</span>}
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
                      <span>{isMarathi ? 'सक्रिय सुवर्ण कर्ज खाती सूचना' : 'Existing Customer Active Loans Notice'}</span>
                    </span>
                    <span className="px-2.5 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[11px] font-black border border-amber-300">
                      {activeLoansForSelectedCust.length} {isMarathi ? 'सक्रिय कर्जे' : (activeLoansForSelectedCust.length === 1 ? 'Active Loan' : 'Active Loans')}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    <strong>{selectedCustomerObj.full_name}</strong> {isMarathi
                      ? `यांच्या नावे सध्या ${activeLoansForSelectedCust.length} सक्रिय सुवर्ण कर्ज(े) असून एकूण शिल्लक मुद्दल `
                      : `currently has ${activeLoansForSelectedCust.length} active gold loan(s) with a total outstanding principal of `}
                    <strong>{formatCurrency(totalActiveAmountForSelectedCust)}</strong>:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeLoansForSelectedCust.map((l, idx) => (
                      <span
                        key={`${l.id}-${l.loan_number}-${idx}`}
                        className="px-2.5 py-1 bg-white border border-amber-300 text-amber-900 rounded-lg text-[11px] font-bold shadow-2xs flex items-center gap-1.5"
                      >
                        <span className="font-extrabold text-slate-900">{l.loan_number}</span>
                        <span className="text-amber-700">({formatCurrency(l.loan_amount)})</span>
                        <span className="text-[10px] text-slate-500 font-medium">[{l.gold_item?.ornament_type || (isMarathi ? 'दागिना' : 'Gold Item')}]</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-amber-700 font-semibold italic border-t border-amber-200/80 pt-1.5">
                    ℹ️ {isMarathi
                      ? `हे कर्ज वितरित केल्यास ग्राहकाचे वेगळे प्रोफाइल न बनवता ${selectedCustomerObj.full_name} यांच्या खात्याशी लिंक केले जाईल.`
                      : `Disbursing this loan will issue an additional active loan linked to ${selectedCustomerObj.full_name}'s profile without creating duplicate customer profiles.`}
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
                <span>
                  {dict.loan.pledgedGoldOrnaments} ({ornaments.length} {isMarathi ? 'वस्तू' : (ornaments.length === 1 ? 'Item' : 'Items')})
                </span>
              </span>
              <button
                type="button"
                onClick={handleAddOrnament}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Plus className="w-4 h-4 text-amber-700" />
                <span>{dict.loan.addAnotherOrnament}</span>
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
                    <span>{dict.loan.ornamentItem} #{index + 1}</span>
                  </span>

                  {ornaments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOrnament(item.id)}
                      className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:bg-rose-50 px-2 py-1 rounded-lg"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {isMarathi ? 'दागिना काढा' : 'Remove Item'}
                    </button>
                  )}
                </div>

                {/* Row 0: Metal Type Selector (Gold vs Silver) */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1.5 uppercase tracking-wider">{dict.loan.selectMetalType}</label>
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
                      <span>🟡 {dict.loan.goldCollateral}</span>
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
                      <span>⚪ {dict.loan.silverCollateral}</span>
                    </button>
                  </div>
                </div>

                {/* Row 1: Ornament Name & Karat Purity */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {dict.loan.ornamentName}
                    </label>
                    <input
                      type="text"
                      placeholder={item.metalType === 'Silver' ? (isMarathi ? 'उदा. चांदीची पैंजण, नाणी...' : 'e.g. Silver Payal, Silver Anklet, Silver Coins...') : (isMarathi ? 'उदा. सोन्याचा हार, पाटल्या...' : 'e.g. 22K Gold Necklace, Set of 4 Bangles...')}
                      value={item.ornamentName}
                      onChange={(e) => handleUpdateOrnament(item.id, 'ornamentName', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.purityGrade}</label>
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
                          <option value="22K (91.6%)">{isMarathi ? '२२ कॅरेट मानक हॉलमार्क (९१.६%)' : '22K Standard Hallmark (91.6%)'}</option>
                          <option value="24K (99.9%)">{isMarathi ? '२४ कॅरेट शुद्ध सोने (९९.९%)' : '24K Fine Gold (99.9%)'}</option>
                          <option value="20K (83.3%)">{isMarathi ? '२० कॅरेट सोने (८३.३%)' : '20K Gold (83.3%)'}</option>
                          <option value="18K (75.0%)">{isMarathi ? '१८ कॅरेट दागिना सोने (७५.०%)' : '18K Jewellery Gold (75.0%)'}</option>
                          <option value="14K (58.5%)">{isMarathi ? '१४ कॅरेट दागिना सोने (५८.५%)' : '14K Ornament Gold (58.5%)'}</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* Row 2: Gross Weight (g) & Stones Deduction (g) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.grossWeightGrams}</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder={dict.loan.enterGrossWeight}
                      value={item.grossWeight === 0 || item.grossWeight === undefined ? (item.grossWeight === 0 ? '' : (item.grossWeight ?? '')) : item.grossWeight}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateOrnament(item.id, 'grossWeight', val);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">{dict.loan.digitsOnly}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.stoneWeightGrams}</label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder={dict.loan.enterStoneWeight}
                      value={item.stoneWeight === 0 || item.stoneWeight === undefined ? (item.stoneWeight === 0 ? '' : (item.stoneWeight ?? '')) : item.stoneWeight}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleUpdateOrnament(item.id, 'stoneWeight', val);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">{dict.loan.digitsOnly}</p>
                  </div>
                </div>

                {/* Row 3: Ornament Photo (Camera or Upload) */}
                <div>
                  <DocumentCameraUpload
                    label={isMarathi ? `दागिना वस्तू #${index + 1} फोटो (कॅमेरा किंवा अपलोड)` : `Item #${index + 1} Photo (Camera or Upload)`}
                    value={item.photoUrl}
                    onChange={(url) => handleUpdateOrnament(item.id, 'photoUrl', url)}
                    aspectRatio="card"
                  />
                </div>

                {/* Row 4: Hallmark HUID & Locker # */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.hallmarkHuidOptional}</label>
                    <input
                      type="text"
                      placeholder="e.g. HUID-MH-994821"
                      value={item.hallmarkNumber}
                      onChange={(e) => handleUpdateOrnament(item.id, 'hallmarkNumber', e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.vaultPocketLocker}</label>
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
            <div className="p-4 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-slate-50 rounded-2xl border-2 border-amber-300/80 space-y-3">
              <div className="flex items-center justify-between text-xs text-amber-950 font-bold border-b border-amber-200 pb-2">
                <span className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-amber-700" />
                  {dict.loan.combinedValuationSummary} ({ornaments.length} {isMarathi ? 'तारण वस्तू' : 'Pledged Items'})
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 font-extrabold">
                  {dict.loan.totalNetGold}: {formatWeight(totalNetWeight)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-medium text-slate-700 pt-1">
                <div>
                  <span className="text-slate-500">{dict.goldItem.grossWeight}:</span>{' '}
                  <strong className="text-slate-900">{formatWeight(totalGrossWeight)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">{dict.goldItem.stoneWeight}:</span>{' '}
                  <strong className="text-slate-900">{formatWeight(totalStoneWeight)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">{dict.loan.fullMarketValue}</span>{' '}
                  <strong className="text-amber-900 font-extrabold text-sm">{formatCurrency(totalEstimatedMarketValue)}</strong>
                </div>
              </div>

              {/* DEDICATED DISBURSAL STRATEGY SELECTOR BAR */}
              <div className="pt-2 border-t border-amber-200 space-y-2">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                  {dict.loan.selectDisbursalStrategy}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Option 1: 75% LTV */}
                  <button
                    type="button"
                    onClick={() => {
                      setDisbursalStrategy('LTV_75');
                      setAllow80Ltv(false);
                      setLoanAmount(totalMaxLoanAmount);
                      setIsCustomLoanAmount(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                      disbursalStrategy === 'LTV_75'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold block opacity-80">{dict.loan.ltv75Standard}</span>
                    <span className="text-xs font-extrabold block">{formatCurrency(totalMaxLoanAmount)}</span>
                  </button>

                  {/* Option 2: 80% LTV */}
                  <button
                    type="button"
                    onClick={() => {
                      setDisbursalStrategy('LTV_80');
                      setAllow80Ltv(true);
                      setLoanAmount(totalMaxLoanAmount80);
                      setIsCustomLoanAmount(false);
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                      disbursalStrategy === 'LTV_80'
                        ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold block opacity-80">{dict.loan.ltv80High}</span>
                    <span className="text-xs font-extrabold block">{formatCurrency(totalMaxLoanAmount80)}</span>
                  </button>

                  {/* Option 3: 100% Market Value */}
                  <button
                    type="button"
                    onClick={() => {
                      setDisbursalStrategy('FULL_100');
                      setLoanAmount(totalEstimatedMarketValue);
                      setIsCustomLoanAmount(true);
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                      disbursalStrategy === 'FULL_100'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm font-bold'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold block opacity-80">{dict.loan.ltv100Full}</span>
                    <span className="text-xs font-extrabold block">{formatCurrency(totalEstimatedMarketValue)}</span>
                  </button>

                  {/* Option 4: Custom Over-Market Valuation (>100%) */}
                  <button
                    type="button"
                    onClick={() => {
                      setDisbursalStrategy('CUSTOM_OVER_VALUATION');
                      setIsCustomLoanAmount(true);
                      if (loanAmount <= totalEstimatedMarketValue) {
                        setLoanAmount(Math.round(totalEstimatedMarketValue * 1.10));
                      }
                    }}
                    className={`p-2.5 rounded-xl border-2 text-left transition-all ${
                      disbursalStrategy === 'CUSTOM_OVER_VALUATION'
                        ? 'bg-purple-700 text-white border-purple-800 shadow-md font-bold'
                        : 'bg-purple-50 text-purple-900 border-purple-200 hover:border-purple-400'
                    }`}
                  >
                    <span className="text-[10px] uppercase font-extrabold block text-amber-300">{dict.loan.overMarketCustom}</span>
                    <span className="text-xs font-black block">{isMarathi ? 'सानुकूल रक्कम' : 'Custom Amount'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Loan Terms & Tenure */}
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              {dict.loan.disbursalTenureTerms}
            </span>

            {/* DEDICATED CUSTOM OVER-MARKET VALUATION SECTION */}
            {disbursalStrategy === 'CUSTOM_OVER_VALUATION' && (
              <div className="p-4 bg-purple-950/5 border-2 border-purple-300 rounded-2xl space-y-3">
                <div className="flex items-center justify-between border-b border-purple-200 pb-2">
                  <span className="text-xs font-black text-purple-950 uppercase tracking-wider flex items-center gap-1.5">
                    <span>⚡ {isMarathi ? 'दुकानदार विशेष अधिक मूल्यांकन कर्ज वितरण' : 'Dedicated Shop Owner Over-Market Valuation Disbursal Section'}</span>
                  </span>
                  <span className="text-[10px] font-extrabold bg-purple-200 text-purple-950 px-2 py-0.5 rounded-full">
                    {isMarathi ? 'दुकानदार स्वेच्छाधिकार' : 'Shop Owner Discretion'}
                  </span>
                </div>

                <p className="text-xs text-purple-900 leading-tight">
                  {isMarathi
                    ? '१००% बाजार मूल्यापेक्षा जास्त रक्कम प्रविष्ट करा (उदा. ₹१,००,००० मूल्याच्या दागिन्यावर ₹१,१०,००० कर्ज मंजूर करा).'
                    : 'Enter any custom sanctioned amount higher than the 100% market valuation (e.g. ₹1,10,000 for gold valued at ₹1,00,000).'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-extrabold text-purple-950 mb-1">
                      {isMarathi ? 'सानुकूल मंजूर रक्कम (₹) *' : 'Custom Sanctioned Amount (₹)'} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => {
                        setLoanAmount(Number(e.target.value));
                        setIsCustomLoanAmount(true);
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-purple-400 rounded-xl text-base font-black text-purple-950 focus:ring-2 focus:ring-purple-600 focus:outline-none"
                      placeholder="e.g. 110000"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-purple-900 mb-1">{isMarathi ? 'जलद अधिक रक्कम पर्याय:' : 'Quick Over-Market Addons:'}</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { label: '+5% (105%)', pct: 1.05 },
                        { label: '+10% (110%)', pct: 1.10 },
                        { label: '+15% (115%)', pct: 1.15 },
                        { label: '+20% (120%)', pct: 1.20 },
                      ].map((item) => {
                        const amt = Math.round(totalEstimatedMarketValue * item.pct);
                        return (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                              setLoanAmount(amt);
                              setIsCustomLoanAmount(true);
                            }}
                            className="px-2 py-1.5 bg-white hover:bg-purple-100 border border-purple-300 rounded-lg text-[11px] font-bold text-purple-900 transition-all text-center"
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Over-Valuation Live Calculation Breakdown */}
                <div className="p-3 bg-white rounded-xl border border-purple-200 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold text-slate-700">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{dict.loan.fullMarketValue}</span>
                    <strong className="text-slate-900 text-sm font-extrabold">{formatCurrency(totalEstimatedMarketValue)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{dict.loan.loanAmount}</span>
                    <strong className="text-purple-700 text-sm font-extrabold">{formatCurrency(loanAmount)}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{isMarathi ? 'प्रभावी LTV प्रमाण' : 'Effective LTV Ratio'}</span>
                    <strong className="text-purple-700 text-sm font-extrabold">
                      {totalEstimatedMarketValue > 0 ? ((loanAmount / totalEstimatedMarketValue) * 100).toFixed(1) : 0}%
                    </strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">{isMarathi ? 'अधिक वाढीव कर्ज' : 'Over-Market Credit'}</span>
                    <strong className="text-emerald-700 text-sm font-extrabold">
                      {loanAmount > totalEstimatedMarketValue ? `+${formatCurrency(loanAmount - totalEstimatedMarketValue)}` : '₹0'}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {disbursalStrategy !== 'CUSTOM_OVER_VALUATION' && (
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                      <span>{dict.loan.sanctionedLoanAmount}</span>
                    </label>
                    <input
                      type="number"
                      value={loanAmount}
                      onChange={(e) => {
                        setLoanAmount(Number(e.target.value));
                        setIsCustomLoanAmount(true);
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-extrabold text-amber-700 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      required
                    />
                    <p className="text-[10px] font-medium text-slate-500 mt-1">
                      {isMarathi ? 'मूल्यांकन:' : 'Valuation:'} <strong>{formatCurrency(totalEstimatedMarketValue)}</strong>
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.monthlyInterestRate}</label>
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
                    {dict.loan.loanTenureMonths}
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

              {/* Informational Custom Loan Badges when not in dedicated custom mode */}
              {disbursalStrategy !== 'CUSTOM_OVER_VALUATION' && loanAmount > totalEstimatedMarketValue && totalEstimatedMarketValue > 0 && (
                <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-200 flex items-start gap-2 text-purple-900 text-xs">
                  <span className="text-base shrink-0">⚡</span>
                  <div>
                    <strong className="block font-bold">{isMarathi ? 'सानुकूल अधिक मूल्यांकन कर्ज सक्रिय' : 'Custom Over-Market Disbursal Active'}</strong>
                    <span>
                      {isMarathi
                        ? `मंजूर रक्कम (${formatCurrency(loanAmount)}) ही १००% बाजार मूल्यापेक्षा (${formatCurrency(totalEstimatedMarketValue)}) `
                        : `Sanctioned amount (${formatCurrency(loanAmount)}) exceeds 100% Market Valuation (${formatCurrency(totalEstimatedMarketValue)}) by `}
                      <strong>{formatCurrency(loanAmount - totalEstimatedMarketValue)}</strong> {isMarathi ? 'जास्त आहे.' : '.'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Tenure Selection Pills */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{dict.loan.quickTenure}</span>
              {[
                { label: dict.loan.threeMonths, value: 3 },
                { label: dict.loan.sixMonths, value: 6 },
                { label: dict.loan.twelveMonths, value: 12 },
                { label: dict.loan.twentyFourMonths, value: 24 },
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
                {dict.loan.selectRepaymentModel}
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
                      <span>🟡 {dict.loan.bulletRepayment}</span>
                    </span>
                    {repaymentModel === 'Bullet Repayment' && (
                      <CheckCircle2 className="w-4 h-4 text-amber-700" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    {isMarathi
                      ? 'पारंपरिक भारतीय सुवर्ण कर्ज पद्धत (मुथूट/मण्णप्पुरम प्रमाणे). ग्राहक दरमहा व्याज भरतो आणि मुदत समाप्तीवेळी मुद्दल परतफेड करतो.'
                      : 'Traditional Indian Gold Finance (Muthoot/Manappuram style). Borrower pays interest monthly; principal repaid at maturity or before auction.'}
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
                      <span>🟢 {dict.loan.reducingBalanceEMI}</span>
                    </span>
                    {repaymentModel === 'Reducing Balance EMI' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 leading-tight">
                    {isMarathi
                      ? 'निश्चित मासिक हप्ता (EMI). प्रत्येक भरण्यानंतर शिल्लक राहिलेल्या मुद्दलावरच व्याज आकारले जाते; मुद्दल ₹० झाल्यावर खाते बंद होते.'
                      : 'Fixed monthly EMI. Interest charged strictly on remaining outstanding principal after each payment; loan closes when principal hits ₹0.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{dict.loan.repaymentScheme}</label>
                <select
                  value={schemeName}
                  onChange={(e) => setSchemeName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="Standard Monthly">{isMarathi ? 'मानक मासिक व्याज योजना' : 'Standard Monthly Interest'}</option>
                  <option value="Bullet Repayment">{isMarathi ? 'मुदतअंती व्याज परतफेड' : 'Bullet Interest at Maturity'}</option>
                  <option value="Festive Special">{isMarathi ? 'सणासुदीची विशेष योजना' : 'Festive Special Scheme'}</option>
                </select>
              </div>

              {/* Calculated Tenure & Maturity Preview Card */}
              <div className="p-3 bg-slate-900 text-white rounded-xl space-y-1.5 font-medium text-xs border border-slate-800">
                <div className="flex justify-between items-center text-slate-400 text-[11px]">
                  <span>🗓️ {isMarathi ? 'वितरण दिनांक:' : 'Disbursal Date:'}</span>
                  <span className="font-bold text-white">{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center text-amber-400 text-[11px]">
                  <span>⌛ {isMarathi ? 'मुदत समाप्ती दिनांक:' : 'Maturity / Due Date:'}</span>
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
                    {repaymentModel === 'Reducing Balance EMI'
                      ? (isMarathi ? 'अंदाजे मासिक हप्ता (EMI):' : 'Est. Monthly EMI:')
                      : (isMarathi ? 'अंदाजे मासिक व्याज:' : 'Est. Monthly Interest:')}
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
              {dict.common.cancel}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl shadow-md gold-glow hover:brightness-105 transition-all flex items-center gap-2"
            >
              <Coins className="w-4 h-4" />
              <span>
                {loading
                  ? dict.common.processing
                  : isMarathi
                  ? `सुवर्ण कर्ज मंजूर करा (${ornaments.length} वस्तू)`
                  : `Disburse Gold Loan (${ornaments.length} Items)`}
              </span>
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
                <h3 className="text-base font-bold text-slate-900">{dict.customer.registerNewBorrowerModalTitle}</h3>
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
                  {dict.customer.basicDetails}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {dict.customer.customerName} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={dict.customer.namePlaceholder}
                      value={newCustName}
                      onChange={(e) => setNewCustName(e.target.value.replace(/[^a-zA-Z\s]/g, ''))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {dict.customer.mobileNumber} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={dict.customer.mobilePlaceholder}
                      maxLength={10}
                      value={newCustMobile}
                      onChange={(e) => setNewCustMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                      required
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isMarathi ? 'केवळ १० अंकी मोबाईल क्रमांक' : 'Exactly 10 numeric digits only'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {dict.customer.aadhaarNumber} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={dict.customer.aadhaarPlaceholder}
                      maxLength={14}
                      value={newCustAadhaar ? newCustAadhaar.replace(/(\d{4})(\d{4})?(\d{4})?/, (_, p1, p2, p3) => [p1, p2, p3].filter(Boolean).join(' ')) : ''}
                      onChange={(e) => setNewCustAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                      required
                    />
                    <p className="text-[10px] text-amber-700 font-bold mt-0.5">
                      {isMarathi ? 'नमुना: XXXX XXXX XXXX (१२ अंकी)' : 'Format: XXXX XXXX XXXX (12 digits)'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{dict.customer.panNumber}</label>
                    <input
                      type="text"
                      placeholder={dict.customer.panPlaceholder}
                      maxLength={10}
                      value={newCustPan}
                      onChange={(e) => setNewCustPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                      className="w-full min-h-[44px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {isMarathi ? 'नमुना: ABCDE1234F (५ अक्षरे, ४ अंक, १ अक्षर)' : 'Format: ABCDE1234F (5 letters, 4 digits, 1 letter)'}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{dict.customer.address}</label>
                  <textarea
                    rows={2}
                    placeholder={dict.customer.addressPlaceholder}
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    className="w-full min-h-[50px] px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-amber-500 focus:outline-none transition-shadow"
                    required
                  />
                </div>
              </div>

              {/* Section 2: Camera Photo & WebP Documents */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4" />
                    <span>{dict.customer.mandatoryCameraKyc}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3 text-emerald-600" />
                    <span>{dict.customer.autoWebpCompression}</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo Upload Mandatory */}
                  <DocumentCameraUpload
                    label={dict.customer.photoUpload}
                    required={true}
                    value={photoUrl}
                    onChange={setPhotoUrl}
                    aspectRatio="square"
                  />

                  {/* Aadhaar Card Front Mandatory */}
                  <DocumentCameraUpload
                    label={dict.customer.aadhaarFront}
                    required={true}
                    value={aadhaarFrontUrl}
                    onChange={setAadhaarFrontUrl}
                  />

                  {/* Aadhaar Card Back Mandatory */}
                  <DocumentCameraUpload
                    label={dict.customer.aadhaarBack}
                    required={true}
                    value={aadhaarBackUrl}
                    onChange={setAadhaarBackUrl}
                  />

                  {/* PAN Card Optional */}
                  <DocumentCameraUpload
                    label={dict.customer.panCardOptional}
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
                  {dict.common.cancel}
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
                    <span>{isMarathi ? 'पुन्हा प्रयत्न करा' : 'Retry Saving Customer'}</span>
                  ) : (
                    <span>{dict.customer.saveCustomerKycBtn}</span>
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
