-- ============================================================
-- SuvarnaLoan ERP - Multi-Tenant Row Level Security & Performance Indexing (05)
-- Location: supabase/migrations/05_enable_rls_and_security_policies.sql
-- ============================================================

-- 1. Enable Row-Level Security on All Core Business Tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'branches') THEN
    EXECUTE 'ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY';
  END IF;
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_documents') THEN
    EXECUTE 'ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

-- 2. DROP ALL OLD RECURSIVE & CONFLICTING POLICIES
DROP POLICY IF EXISTS "Tenant Isolation for Shops" ON public.shops;
DROP POLICY IF EXISTS "Public Shop Read for Login" ON public.shops;
DROP POLICY IF EXISTS "Shops Tenant Isolation Policy" ON public.shops;

DROP POLICY IF EXISTS "Tenant Isolation for Users" ON public.users;
DROP POLICY IF EXISTS "Public User Read for Login" ON public.users;
DROP POLICY IF EXISTS "Users Tenant Isolation Policy" ON public.users;

DROP POLICY IF EXISTS "Public Customers Access" ON public.customers;
DROP POLICY IF EXISTS "Customers Tenant Isolation Policy" ON public.customers;

DROP POLICY IF EXISTS "Public Gold Items Access" ON public.gold_items;
DROP POLICY IF EXISTS "Gold Items Tenant Isolation Policy" ON public.gold_items;

DROP POLICY IF EXISTS "Public Loans Access" ON public.loans;
DROP POLICY IF EXISTS "Loans Tenant Isolation Policy" ON public.loans;

DROP POLICY IF EXISTS "Public Payments Access" ON public.payments;
DROP POLICY IF EXISTS "Payments Tenant Isolation Policy" ON public.payments;

DROP POLICY IF EXISTS "Audit Logs Tenant Isolation Policy" ON public.audit_logs;

DROP POLICY IF EXISTS "Tenant Isolation for Customer Documents" ON public.customer_documents;
DROP POLICY IF EXISTS "Public Customer Documents Access" ON public.customer_documents;
DROP POLICY IF EXISTS "Customer Documents Tenant Isolation Policy" ON public.customer_documents;

DROP FUNCTION IF EXISTS public.get_user_shop_id(text);
DROP FUNCTION IF EXISTS public.is_super_admin(text);
DROP FUNCTION IF EXISTS public.get_user_shop_id();
DROP FUNCTION IF EXISTS public.is_super_admin();

-- 3. Define Correct Supabase PostgREST JWT Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_shop_id() 
RETURNS text 
LANGUAGE sql 
STABLE
AS $$
  SELECT current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'shop_id';
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin() 
RETURNS boolean 
LANGUAGE sql 
STABLE
AS $$
  SELECT coalesce(
    (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'role') = 'Super Admin',
    (SELECT u.role::text FROM public.users u WHERE u.id::text = auth.uid()::text) = 'Super Admin',
    FALSE
  );
$$;

-- Grant EXECUTE privileges to authenticated & anon roles
GRANT EXECUTE ON FUNCTION public.get_user_shop_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;

-- 4. Multi-Tenant Row-Level Security Policies (Supabase JWT Based)

-- Shops Table Policy
CREATE POLICY "Shops Tenant Isolation Policy" ON public.shops
  FOR ALL
  USING (
    public.is_super_admin() OR
    id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    public.is_super_admin() OR
    id::text = public.get_user_shop_id()
  );

-- Users Table Policy
CREATE POLICY "Users Tenant Isolation Policy" ON public.users
  FOR ALL
  USING (
    id::text = auth.uid()::text OR
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    id::text = auth.uid()::text OR
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  );

-- Customers Table Policy
CREATE POLICY "Customers Tenant Isolation Policy" ON public.customers
  FOR ALL
  USING (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  );

-- Gold Items Table Policy
CREATE POLICY "Gold Items Tenant Isolation Policy" ON public.gold_items
  FOR ALL
  USING (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  );

-- Loans Table Policy
CREATE POLICY "Loans Tenant Isolation Policy" ON public.loans
  FOR ALL
  USING (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  );

-- Payments Table Policy
CREATE POLICY "Payments Tenant Isolation Policy" ON public.payments
  FOR ALL
  USING (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  );

-- Audit Logs Table Policy
CREATE POLICY "Audit Logs Tenant Isolation Policy" ON public.audit_logs
  FOR ALL
  USING (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  )
  WITH CHECK (
    public.is_super_admin() OR
    shop_id::text = public.get_user_shop_id()
  );

-- Customer Documents Policy
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_documents') THEN
    EXECUTE '
      CREATE POLICY "Customer Documents Tenant Isolation Policy" ON public.customer_documents
        FOR ALL
        USING (
          public.is_super_admin() OR
          shop_id::text = public.get_user_shop_id()
        )
        WITH CHECK (
          public.is_super_admin() OR
          shop_id::text = public.get_user_shop_id()
        );
    ';
  END IF;
END $$;

-- 5. High-Performance B-Tree Composite Database Indexes
CREATE INDEX IF NOT EXISTS idx_customers_shop_created ON public.customers(shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loans_shop_status ON public.loans(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_shop_loan ON public.payments(shop_id, loan_id);
CREATE INDEX IF NOT EXISTS idx_gold_items_shop_cust ON public.gold_items(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_users_shop_role ON public.users(shop_id, role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_created ON public.audit_logs(shop_id, created_at DESC);
