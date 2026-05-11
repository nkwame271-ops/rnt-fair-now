-- 1. Fix: prevent student-related escrow splits from leaking into regulator views.
DROP POLICY IF EXISTS "Regulators read all splits" ON public.escrow_splits;

-- 2. Broaden student-revenue read access to all main/super admins (per `is_main_admin` source-of-truth).
DROP POLICY IF EXISTS "Super admins read student escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Main admins read student escrow transactions"
  ON public.escrow_transactions FOR SELECT
  USING (public.is_main_admin(auth.uid()) AND is_student_revenue = true);

DROP POLICY IF EXISTS "Super admins read student escrow splits" ON public.escrow_splits;
CREATE POLICY "Main admins read student escrow splits"
  ON public.escrow_splits FOR SELECT
  USING (
    public.is_main_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.escrow_transactions et
      WHERE et.id = escrow_splits.escrow_transaction_id
        AND et.is_student_revenue = true
    )
  );

-- 3. Turn on the NUGS Rent Cards feature so sub-admins inherit it from the main NUGS admin's toggle.
UPDATE public.feature_flags SET is_enabled = true, updated_at = now()
  WHERE feature_key = 'nugs_admin_rent_cards';
