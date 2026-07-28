-- ============================================================
-- SuvarnaLoan ERP - Database Architecture Remediation (V2)
-- Location: supabase/migrations/02_database_architecture_fixes.sql
-- ============================================================

-- 1. Declare Formal Branches Table & Constraints
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  phone VARCHAR(20),
  manager_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Foreign keys on customers and loans to branches
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_customers_branch') THEN
    ALTER TABLE public.customers ADD CONSTRAINT fk_customers_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_loans_branch') THEN
    ALTER TABLE public.loans ADD CONSTRAINT fk_loans_branch FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Financial Ledger Protection: Change CASCADE to RESTRICT
ALTER TABLE public.loans DROP CONSTRAINT IF EXISTS loans_customer_id_fkey;
ALTER TABLE public.loans ADD CONSTRAINT loans_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_loan_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES public.loans(id) ON DELETE RESTRICT;

-- 3. Soft Delete Timestamps
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.gold_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 4. Composite Unique Constraint on Receipts per Shop
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_payment_receipt_shop') THEN
    ALTER TABLE public.payments ADD CONSTRAINT uq_payment_receipt_shop UNIQUE (shop_id, receipt_number);
  END IF;
END $$;

-- 5. Positive Monetary & Weight CHECK Constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_loan_amount_positive') THEN
    ALTER TABLE public.loans ADD CONSTRAINT chk_loan_amount_positive CHECK (loan_amount > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payment_amount_positive') THEN
    ALTER TABLE public.payments ADD CONSTRAINT chk_payment_amount_positive CHECK (amount > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_gold_net_weight_positive') THEN
    ALTER TABLE public.gold_items ADD CONSTRAINT chk_gold_net_weight_positive CHECK (net_weight > 0);
  END IF;
END $$;

-- 6. Enforce NOT NULL Tenant Keys
ALTER TABLE public.payments ALTER COLUMN shop_id SET NOT NULL;
ALTER TABLE public.gold_items ALTER COLUMN shop_id SET NOT NULL;

-- 7. Optimistic Locking Version Column
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1 NOT NULL;

-- 8. Automatic updated_at Trigger Function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.gold_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS trigger_shops_updated_at ON public.shops;
CREATE TRIGGER trigger_shops_updated_at BEFORE UPDATE ON public.shops FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_customers_updated_at ON public.customers;
CREATE TRIGGER trigger_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_gold_items_updated_at ON public.gold_items;
CREATE TRIGGER trigger_gold_items_updated_at BEFORE UPDATE ON public.gold_items FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_loans_updated_at ON public.loans;
CREATE TRIGGER trigger_loans_updated_at BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_payments_updated_at ON public.payments;
CREATE TRIGGER trigger_payments_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 9. Optimized RLS Function (STABLE cached per-statement execution)
CREATE OR REPLACE FUNCTION get_user_shop_id() 
RETURNS UUID AS $$
  SELECT shop_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 10. Atomic Stored Procedure for Gold Loan Disbursement Transaction
CREATE OR REPLACE FUNCTION public.disburse_gold_loan(
  p_shop_id UUID,
  p_customer_id UUID,
  p_ornament_type VARCHAR(100),
  p_gross_weight DECIMAL(10,3),
  p_net_weight DECIMAL(10,3),
  p_purity VARCHAR(50),
  p_estimated_value DECIMAL(15,2),
  p_loan_amount DECIMAL(15,2),
  p_interest_rate DECIMAL(5,2),
  p_due_date DATE,
  p_loan_number VARCHAR(50),
  p_user_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_gold_id UUID;
  v_loan_id UUID;
BEGIN
  -- Insert Gold Asset
  INSERT INTO public.gold_items (
    customer_id, shop_id, ornament_type, gross_weight, net_weight, purity, estimated_value
  ) VALUES (
    p_customer_id, p_shop_id, p_ornament_type, p_gross_weight, p_net_weight, p_purity, p_estimated_value
  ) RETURNING id INTO v_gold_id;

  -- Insert Loan
  INSERT INTO public.loans (
    shop_id, customer_id, gold_item_id, loan_number, loan_amount, interest_rate, due_date, created_by
  ) VALUES (
    p_shop_id, p_customer_id, v_gold_id, p_loan_number, p_loan_amount, p_interest_rate, p_due_date, p_user_id
  ) RETURNING id INTO v_loan_id;

  -- Insert Audit Log Entry
  INSERT INTO public.audit_logs (
    shop_id, user_id, action, table_name, record_id, new_data
  ) VALUES (
    p_shop_id, p_user_id, 'CREATE', 'loans', v_loan_id,
    jsonb_build_object('loan_number', p_loan_number, 'amount', p_loan_amount)
  );

  RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
