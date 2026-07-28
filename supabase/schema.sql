-- ============================================================
-- SuvarnaLoan ERP - Complete Production Multi-Tenant Schema
-- Location: supabase/schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Shops (Tenants)
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name VARCHAR(255) NOT NULL,
  owner_name VARCHAR(255) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  plan VARCHAR(50) DEFAULT 'Professional' CHECK (plan IN ('Starter', 'Professional', 'Enterprise')),
  address TEXT,
  logo_url TEXT,
  gstin VARCHAR(20),
  license_number VARCHAR(100),
  gold_rate_24k DECIMAL(10, 2) DEFAULT 7650.00,
  gold_rate_22k DECIMAL(10, 2) DEFAULT 7010.00,
  silver_rate_1kg DECIMAL(10, 2) DEFAULT 95000.00,
  silver_rate_per_gram DECIMAL(10, 2) DEFAULT 95.00,
  use_live_rates BOOLEAN DEFAULT TRUE,
  last_rate_sync_at TIMESTAMP WITH TIME ZONE,
  max_ltv_percentage DECIMAL(5, 2) DEFAULT 75.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Users (Roles: Super Admin, Shop Owner, Staff)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('Super Admin', 'Shop Owner', 'Staff')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Helper function to get current user's shop_id
CREATE OR REPLACE FUNCTION get_user_shop_id() RETURNS UUID AS $$
  SELECT shop_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 3. Customers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id UUID,
  full_name VARCHAR(255) NOT NULL,
  mobile_number VARCHAR(20) NOT NULL,
  alternate_mobile VARCHAR(20),
  email VARCHAR(255),
  aadhaar_number VARCHAR(20),
  pan_number VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(10),
  photo_url TEXT,
  aadhaar_url TEXT,
  pan_url TEXT,
  credit_score INTEGER DEFAULT 750,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Blacklisted')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Gold Items (Assets Pledged)
CREATE TABLE IF NOT EXISTS public.gold_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  ornament_type VARCHAR(100) NOT NULL,
  description TEXT,
  gross_weight DECIMAL(10, 3) NOT NULL,
  stone_weight DECIMAL(10, 3) DEFAULT 0,
  net_weight DECIMAL(10, 3) NOT NULL,
  purity VARCHAR(50) NOT NULL,
  purity_percentage DECIMAL(5, 2) DEFAULT 91.66,
  hallmark_number VARCHAR(100),
  pocket_locker_number VARCHAR(100),
  market_value_per_gram DECIMAL(10, 2),
  estimated_value DECIMAL(15, 2),
  front_image_url TEXT,
  back_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Loans
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id UUID,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  gold_item_id UUID NOT NULL REFERENCES public.gold_items(id) ON DELETE RESTRICT,
  loan_number VARCHAR(50) UNIQUE NOT NULL,
  loan_amount DECIMAL(15, 2) NOT NULL,
  interest_rate DECIMAL(5, 2) DEFAULT 1.50,
  scheme_name VARCHAR(100) DEFAULT 'Standard Monthly',
  loan_purpose VARCHAR(255),
  loan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  closed_date DATE,
  auction_date DATE,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Closed', 'Overdue', 'Auctioned')),
  total_interest_paid DECIMAL(15, 2) DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  payment_type VARCHAR(50) NOT NULL CHECK (payment_type IN ('Interest Payment', 'Partial Payment', 'Full Settlement')),
  amount DECIMAL(15, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(50) NOT NULL,
  receipt_number VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT')),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Customer Documents
CREATE TABLE IF NOT EXISTS public.customer_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100),
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance B-Tree Indexes for Fast Multi-Tenant Filtering
CREATE INDEX IF NOT EXISTS idx_customers_shop_id ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(deleted_at);
CREATE INDEX IF NOT EXISTS idx_gold_items_shop_id ON public.gold_items(shop_id);
CREATE INDEX IF NOT EXISTS idx_gold_items_customer_id ON public.gold_items(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_shop_id ON public.loans(shop_id);
CREATE INDEX IF NOT EXISTS idx_loans_customer_id ON public.loans(customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_gold_item_id ON public.loans(gold_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_id ON public.payments(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON public.payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id ON public.audit_logs(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_shop_id ON public.customer_documents(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_docs_cust_id ON public.customer_documents(customer_id);

-- Atomic Sequential Loan Number Generator
CREATE OR REPLACE FUNCTION generate_next_loan_number(p_shop_id TEXT)
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_count INT;
  v_loan_num TEXT;
BEGIN
  v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COUNT(*) + 1 INTO v_count FROM public.loans WHERE shop_id = p_shop_id;
  v_loan_num := 'GL-' || v_year || '-' || LPAD(v_count::TEXT, 4, '0');
  RETURN v_loan_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can access their shop" ON public.shops
  FOR ALL USING (id = get_user_shop_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'Super Admin');

CREATE POLICY "Users can access customers" ON public.customers
  FOR ALL USING (shop_id = get_user_shop_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'Super Admin');

CREATE POLICY "Users can access gold items" ON public.gold_items
  FOR ALL USING (shop_id = get_user_shop_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'Super Admin');

CREATE POLICY "Users can access loans" ON public.loans
  FOR ALL USING (shop_id = get_user_shop_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'Super Admin');

CREATE POLICY "Users can access payments" ON public.payments
  FOR ALL USING (shop_id = get_user_shop_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'Super Admin');
