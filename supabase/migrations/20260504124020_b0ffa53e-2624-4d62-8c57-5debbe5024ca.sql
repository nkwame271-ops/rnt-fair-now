-- 1. Add is_student_revenue flag to escrow_transactions
ALTER TABLE public.escrow_transactions
ADD COLUMN IF NOT EXISTS is_student_revenue boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_escrow_transactions_student_revenue
  ON public.escrow_transactions (is_student_revenue) WHERE is_student_revenue = true;

-- 2. New system settlement account types: NUGS and CM
INSERT INTO public.system_settlement_accounts (account_type, payment_method, account_name)
VALUES
  ('nugs', 'bank', 'NUGS'),
  ('cm', 'bank', 'CM')
ON CONFLICT (account_type) DO NOTHING;

-- 3. Feature flags for student fees
INSERT INTO public.feature_flags (feature_key, label, description, category, is_enabled, fee_enabled, fee_amount)
VALUES
  ('student_registration', 'Student Registration Fee', 'Flat fee paid by students at signup', 'fee', true, true, 50),
  ('student_complaint_fee', 'Student Complaint Filing Fee', 'Flat fee paid when a student files a complaint', 'fee', true, true, 20)
ON CONFLICT (feature_key) DO NOTHING;

-- 4. Default split configurations for student payment types (flat amounts)
-- Student registration: 50 GHS = IGF 20 + NUGS 15 + Platform 10 + CM 5
INSERT INTO public.split_configurations (payment_type, recipient, amount_type, amount, description, sort_order)
VALUES
  ('student_registration', 'igf', 'flat', 20, 'IGF share of student registration', 0),
  ('student_registration', 'nugs', 'flat', 15, 'NUGS share of student registration', 1),
  ('student_registration', 'platform', 'flat', 10, 'Platform share of student registration', 2),
  ('student_registration', 'cm', 'flat', 5, 'CM share of student registration', 3),
  ('student_complaint_fee', 'igf', 'flat', 8, 'IGF share of student complaint', 0),
  ('student_complaint_fee', 'nugs', 'flat', 6, 'NUGS share of student complaint', 1),
  ('student_complaint_fee', 'platform', 'flat', 4, 'Platform share of student complaint', 2),
  ('student_complaint_fee', 'cm', 'flat', 2, 'CM share of student complaint', 3)
ON CONFLICT (payment_type, recipient, sort_order) DO NOTHING;

-- 5. RLS: hide student revenue from non-super-admins
-- escrow_transactions: drop existing regulator-read policy and replace with split policies
DROP POLICY IF EXISTS "Regulators read all escrow transactions" ON public.escrow_transactions;

CREATE POLICY "Regulators read non-student escrow transactions"
ON public.escrow_transactions
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'regulator'::app_role)
  AND is_student_revenue = false
);

CREATE POLICY "Super admins read student escrow transactions"
ON public.escrow_transactions
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND is_student_revenue = true
);

-- escrow_splits: gate by parent transaction
DROP POLICY IF EXISTS "Regulators read escrow splits" ON public.escrow_splits;
DROP POLICY IF EXISTS "Regulators read all escrow splits" ON public.escrow_splits;

CREATE POLICY "Regulators read non-student escrow splits"
ON public.escrow_splits
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'regulator'::app_role)
  AND EXISTS (
    SELECT 1 FROM public.escrow_transactions et
    WHERE et.id = escrow_splits.escrow_transaction_id
      AND et.is_student_revenue = false
  )
);

CREATE POLICY "Super admins read student escrow splits"
ON public.escrow_splits
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.escrow_transactions et
    WHERE et.id = escrow_splits.escrow_transaction_id
      AND et.is_student_revenue = true
  )
);
