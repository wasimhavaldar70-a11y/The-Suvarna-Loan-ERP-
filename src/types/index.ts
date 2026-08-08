// ========================================================
// SuvarnaLoan ERP - Domain TypeScript Interfaces
// Location: src/types/index.ts
// ========================================================

export type UserRole = 'Super Admin' | 'Shop Owner' | 'Staff';
export type CustomerStatus = 'Active' | 'Blacklisted';
export type LoanStatus = 'Active' | 'Closed' | 'Overdue' | 'Auctioned';
export type PaymentType = 'Interest Payment' | 'Partial Payment' | 'Full Settlement' | 'Principal Part-Payment';
export type InvoiceStatus = 'Unpaid' | 'Paid' | 'Partial';
export type NotificationChannel = 'WhatsApp' | 'SMS' | 'Email';
export type NotificationStatus = 'Pending' | 'Sent' | 'Failed';
export type DocumentType = 'Aadhaar' | 'PAN' | 'Passport' | 'Voter ID' | 'Driving License' | 'Other';
export type MetalType = 'Gold' | 'Silver';

export interface Shop {
  id: string;
  shop_name: string;
  owner_name: string;
  mobile: string;
  email?: string;
  plan: 'Starter' | 'Professional' | 'Enterprise';
  address?: string;
  logo_url?: string;
  gstin?: string;
  license_number?: string;
  gold_rate_24k?: number;
  gold_rate_22k?: number;
  gold_rate_20k?: number;
  gold_rate_18k?: number;
  silver_rate_1kg?: number;
  silver_rate_per_gram?: number;
  use_live_rates?: boolean;
  last_rate_sync_at?: string;
  max_ltv_percentage?: number;
  is_active?: boolean;
  created_at: string;
}

export interface User {
  id: string;
  shop_id: string | null;
  name: string;
  role: UserRole;
  email?: string;
  created_at: string;
}

export interface SessionData {
  user: User;
  shop: Shop | null;
}

export interface Branch {
  id: string;
  shop_id: string;
  name: string;
  address: string;
  phone?: string;
  manager_id?: string;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  shop_id: string;
  branch_id?: string;
  user_id?: string;
  name: string;
  role: string;
  phone: string;
  email?: string;
  salary?: number;
  joined_at?: string;
  is_active: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  branch_id?: string;
  full_name: string;
  mobile_number: string;
  alternate_mobile?: string;
  email?: string;
  aadhaar_number?: string;
  pan_number?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  photo_url?: string;
  aadhaar_url?: string;
  aadhaar_back_url?: string;
  pan_url?: string;
  nominee_name?: string;
  nominee_relation?: string;
  credit_score?: number;
  status: CustomerStatus;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;
  // Computed fields
  total_loans_count?: number;
  active_loans_count?: number;
}

export interface GoldItem {
  id: string;
  customer_id: string;
  shop_id?: string;
  metal_type?: MetalType;
  ornament_type: string;
  description?: string;
  gross_weight: number; // in grams
  stone_weight: number; // in grams
  net_weight: number; // in grams
  purity: '24K (99.9%)' | '22K (91.6%)' | '20K (83.3%)' | '18K (75.0%)' | '14K (58.5%)' | '999 Fine Silver (99.9%)' | '925 Sterling Silver (92.5%)' | '900 Coin Silver (90.0%)' | '800 Silver (80.0%)' | string;
  purity_percentage: number;
  hallmark_number?: string;
  pocket_locker_number?: string;
  market_value_per_gram?: number;
  estimated_value?: number;
  photo_url?: string;
  front_image_url?: string;
  back_image_url?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;
}

export interface Valuation {
  id: string;
  gold_item_id: string;
  shop_id: string;
  appraised_by?: string;
  metal_type?: MetalType;
  gold_rate_per_gram: number;
  gross_weight: number;
  stone_weight: number;
  net_weight: number;
  purity: string;
  purity_percentage: number;
  estimated_value: number;
  max_loan_amount: number;
  ltv_percentage: number;
  notes?: string;
  created_at: string;
}

export interface LoanDisbursement {
  id: string;
  loan_id: string;
  shop_id: string;
  disbursement_number: number;
  amount: number;
  interest_rate: number;
  disbursement_date: string;
  interest_start_date: string;
  due_date: string;
  tenure_months?: number;
  status: 'Active' | 'Settled';
  principal_outstanding?: number;
  total_interest_paid?: number;
  accrued_interest?: number;
  total_balance_due?: number;
  payment_method?: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  notes?: string;
  disbursed_by?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  payments?: Payment[];
}

export interface Loan {
  id: string;
  shop_id: string;
  branch_id?: string;
  customer_id: string;
  gold_item_id: string;
  loan_number: string;
  loan_amount: number;
  interest_rate: number; // Monthly interest rate (e.g. 1.5% or 3.0%)
  scheme_name: 'Standard Monthly' | 'Bullet Repayment' | 'Festive Special' | 'Custom';
  repayment_model?: 'Reducing Balance EMI' | 'Bullet Repayment' | 'Interest Only';
  loan_purpose?: string;
  tenure_months?: number;
  loan_date: string;
  due_date: string;
  closed_date?: string;
  auction_date?: string;
  status: LoanStatus;
  total_interest_paid?: number;
  created_by?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;

  // Multi-Disbursement Tranches
  disbursements?: LoanDisbursement[];
  total_disbursed?: number;
  total_principal_outstanding?: number;

  // Joined relations for UI
  customer?: Customer;
  gold_item?: GoldItem;
  payments?: Payment[];
  accrued_interest?: number;
  total_balance_due?: number;
}

export interface Invoice {
  id: string;
  loan_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: InvoiceStatus;
  created_at: string;
}

export interface Payment {
  id: string;
  shop_id?: string;
  loan_id: string;
  disbursement_id?: string;
  disbursement_number?: number;
  payment_type: PaymentType;
  amount: number;
  principal_portion?: number;
  interest_portion?: number;
  payment_date: string;
  payment_method: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque';
  receipt_number?: string;
  recorded_by?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;
  // Joined for display
  loan?: Loan;
  disbursement?: LoanDisbursement;
}

export interface Notification {
  id: string;
  shop_id: string;
  customer_id: string;
  loan_id?: string;
  type: 'Payment Due' | 'Overdue Alert' | 'Loan Closed' | 'Custom';
  message: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  sent_at?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  shop_id?: string;
  user_id?: string;
  user_name?: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'ACTIVATION_REQUEST';
  table_name: string;
  record_id?: string;
  old_data?: any;
  new_data?: any;
  ip_address?: string;
  created_at: string;
}

export interface DashboardMetrics {
  totalActiveLoansCount: number;
  totalPortfolioAum: number; // Total principal outstanding
  totalPledgedGoldWeightGrams: number;
  totalPledgedSilverWeightGrams?: number;
  todayCollectionsAmount: number;
  overdueNpaCount: number;
  overdueNpaAmount: number;
  avgLtvPercentage: number;
  goldRate24k: number;
  goldRate22k: number;
  goldRate20k?: number;
  goldRate18k: number;
  silverRate1kg?: number;
  silverRatePerGram?: number;
  monthlyDisbursementVsCollection: Array<{
    month: string;
    disbursed: number;
    collected: number;
  }>;
  portfolioKaratDistribution: Array<{
    name: string;
    value: number;
    weightGrams: number;
  }>;
}
