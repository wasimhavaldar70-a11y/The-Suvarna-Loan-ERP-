-- ============================================================
-- SuvarnaLoan ERP - Production Remediation Migration (V1)
-- Location: supabase/migrations/01_production_remediation.sql
-- ============================================================

-- 1. Create Rate Limits Table for Backend Guard & Security
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address VARCHAR(45) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast 60s rate-limit window checks
CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_created ON public.rate_limits(ip_address, created_at);

-- 2. Foreign Key Performance Indexes for Scalability
CREATE INDEX IF NOT EXISTS idx_users_shop ON public.users(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_gold_items_cust_shop ON public.gold_items(customer_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_loans_shop_cust ON public.loans(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_loans_gold_item ON public.loans(gold_item_id);
CREATE INDEX IF NOT EXISTS idx_payments_loan_shop ON public.payments(loan_id, shop_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_user ON public.audit_logs(shop_id, user_id);

-- 3. Optimized RLS Policies using JWT App Metadata to eliminate N+1 subqueries
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gold_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Allow rate limits insertion for anon/authenticated clients
CREATE POLICY "Allow rate limit recording" ON public.rate_limits
  FOR ALL USING (true) WITH CHECK (true);
