-- ============================================================
-- SuvarnaLoan ERP - Database Performance & Composite Index Optimization (07)
-- Location: supabase/migrations/07_performance_optimization_indexes.sql
-- ============================================================

-- 1. High-Performance Partial & Composite B-Tree Indexes
CREATE INDEX IF NOT EXISTS idx_customers_shop_active ON public.customers(shop_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_customers_mobile_shop ON public.customers(shop_id, mobile_number);
CREATE INDEX IF NOT EXISTS idx_loans_shop_status_active ON public.loans(shop_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_loans_customer_shop ON public.loans(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_shop_date ON public.payments(shop_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_payments_loan_shop ON public.payments(shop_id, loan_id);
CREATE INDEX IF NOT EXISTS idx_gold_items_shop_active ON public.gold_items(shop_id, customer_id) WHERE deleted_at IS NULL;

-- Index for storage document tracking lookups
DO $$ 
BEGIN 
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customer_documents') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_customer_docs_shop_cust ON public.customer_documents(shop_id, customer_id)';
  END IF;
END $$;

-- 2. Fast Zero-Subquery JWT Helper Functions for RLS Policy Enforcement
CREATE OR REPLACE FUNCTION public.get_user_shop_id() 
RETURNS text 
LANGUAGE sql 
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'shop_id', ''),
    (SELECT u.shop_id::text FROM public.users u WHERE u.id::text = auth.uid()::text LIMIT 1)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin() 
RETURNS boolean 
LANGUAGE sql 
STABLE
AS $$
  SELECT coalesce(
    (current_setting('request.jwt.claims', true)::json -> 'user_metadata' ->> 'role') = 'Super Admin',
    (SELECT u.role::text FROM public.users u WHERE u.id::text = auth.uid()::text LIMIT 1) = 'Super Admin',
    FALSE
  );
$$;

-- Grant EXECUTE privileges to authenticated & anon roles
GRANT EXECUTE ON FUNCTION public.get_user_shop_id() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon, service_role;
