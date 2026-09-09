SET LOCAL lock_timeout = '20s';

DROP POLICY IF EXISTS "Main admins read student escrow splits" ON public.escrow_splits;
DROP POLICY IF EXISTS "Regulators read non-student escrow splits" ON public.escrow_splits;
DROP POLICY IF EXISTS "Users read own splits" ON public.escrow_splits;

CREATE OR REPLACE FUNCTION public.readable_escrow_transaction_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(array_agg(et.id), '{}'::uuid[])
  FROM public.escrow_transactions et
  WHERE et.user_id = auth.uid()
     OR (is_main_admin(auth.uid()) AND et.is_student_revenue = true)
     OR (has_role(auth.uid(), 'regulator'::app_role) AND et.is_student_revenue = false)
$$;

REVOKE ALL ON FUNCTION public.readable_escrow_transaction_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.readable_escrow_transaction_ids() TO authenticated, service_role;

CREATE POLICY "Read permitted escrow splits"
ON public.escrow_splits
FOR SELECT
TO authenticated
USING (
  (SELECT public.readable_escrow_transaction_ids()) @> ARRAY[escrow_transaction_id]
);