-- 06_update_payment_type_check_constraint.sql
-- Update payment_type check constraint on public.payments table to include 'Principal Part-Payment'

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_type_check 
  CHECK (payment_type IN ('Interest Payment', 'Partial Payment', 'Principal Part-Payment', 'Full Settlement'));
