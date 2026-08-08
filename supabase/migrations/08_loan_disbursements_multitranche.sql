-- ============================================================
-- SuvarnaLoan ERP - Multi-Disbursement Tranches Schema (08)
-- Location: supabase/migrations/08_loan_disbursements_multitranche.sql
-- ============================================================

-- 1. Create Loan Disbursements Table
CREATE TABLE IF NOT EXISTS public.loan_disbursements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  disbursement_number INTEGER NOT NULL DEFAULT 1,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  interest_rate DECIMAL(5,2) NOT NULL DEFAULT 1.50,
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interest_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  tenure_months INTEGER DEFAULT 12,
  status VARCHAR(50) DEFAULT 'Active' CHECK (status IN ('Active', 'Settled')),
  principal_outstanding DECIMAL(15,2),
  total_interest_paid DECIMAL(15,2) DEFAULT 0.00,
  payment_method VARCHAR(50) DEFAULT 'Cash' CHECK (payment_method IN ('Cash', 'UPI', 'Bank Transfer', 'Cheque')),
  notes TEXT,
  disbursed_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- 2. Add Disbursement ID to Payments Table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS disbursement_id UUID REFERENCES public.loan_disbursements(id) ON DELETE SET NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS disbursement_number INTEGER DEFAULT NULL;

-- 3. Composite Indexes for Fast Tranche Lookups
CREATE INDEX IF NOT EXISTS idx_loan_disbursements_loan_id ON public.loan_disbursements(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_disbursements_shop_id ON public.loan_disbursements(shop_id);
CREATE INDEX IF NOT EXISTS idx_payments_disbursement_id ON public.payments(disbursement_id);

-- 4. Automatic updated_at Trigger for Disbursements
DROP TRIGGER IF EXISTS trigger_loan_disbursements_updated_at ON public.loan_disbursements;
CREATE TRIGGER trigger_loan_disbursements_updated_at
  BEFORE UPDATE ON public.loan_disbursements
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- 5. Stored Procedure to Add Additional Loan Disbursement to Existing Gold Pledge
CREATE OR REPLACE FUNCTION public.add_loan_disbursement(
  p_loan_id UUID,
  p_shop_id UUID,
  p_amount DECIMAL(15,2),
  p_interest_rate DECIMAL(5,2),
  p_disbursement_date DATE,
  p_interest_start_date DATE,
  p_due_date DATE,
  p_tenure_months INTEGER,
  p_payment_method VARCHAR(50),
  p_notes TEXT,
  p_user_name VARCHAR(255) DEFAULT 'Shop Staff'
)
RETURNS UUID AS $$
DECLARE
  v_next_num INTEGER;
  v_disbursement_id UUID;
  v_new_total_principal DECIMAL(15,2);
BEGIN
  -- Get next disbursement number for this loan
  SELECT COALESCE(MAX(disbursement_number), 0) + 1 INTO v_next_num
  FROM public.loan_disbursements
  WHERE loan_id = p_loan_id;

  -- Insert disbursement record
  INSERT INTO public.loan_disbursements (
    loan_id, shop_id, disbursement_number, amount, interest_rate,
    disbursement_date, interest_start_date, due_date, tenure_months,
    status, principal_outstanding, total_interest_paid, payment_method,
    notes, disbursed_by
  ) VALUES (
    p_loan_id, p_shop_id, v_next_num, p_amount, p_interest_rate,
    p_disbursement_date, p_interest_start_date, p_due_date, p_tenure_months,
    'Active', p_amount, 0.00, p_payment_method,
    p_notes, p_user_name
  ) RETURNING id INTO v_disbursement_id;

  -- Update total sanctioned principal in loans master table
  SELECT COALESCE(SUM(amount), p_amount) INTO v_new_total_principal
  FROM public.loan_disbursements
  WHERE loan_id = p_loan_id AND deleted_at IS NULL;

  UPDATE public.loans
  SET loan_amount = v_new_total_principal,
      status = 'Active',
      updated_at = NOW()
  WHERE id = p_loan_id;

  -- Audit log entry
  INSERT INTO public.audit_logs (
    shop_id, user_id, action, table_name, record_id, new_data
  ) VALUES (
    p_shop_id::text, p_user_name, 'CREATE', 'loan_disbursements', v_disbursement_id::text,
    jsonb_build_object(
      'loan_id', p_loan_id,
      'disbursement_number', v_next_num,
      'amount', p_amount,
      'interest_rate', p_interest_rate,
      'disbursement_date', p_disbursement_date
    )
  );

  RETURN v_disbursement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Disable RLS or set open policies
ALTER TABLE public.loan_disbursements DISABLE ROW LEVEL SECURITY;
