SET LOCAL lock_timeout = '20s';

CREATE OR REPLACE FUNCTION public.readable_escrow_transaction_id_set()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT et.id
  FROM public.escrow_transactions et
  WHERE et.user_id = auth.uid()
     OR (is_main_admin(auth.uid()) AND et.is_student_revenue = true)
     OR (has_role(auth.uid(), 'regulator'::app_role) AND et.is_student_revenue = false)
$$;

REVOKE ALL ON FUNCTION public.readable_escrow_transaction_id_set() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.readable_escrow_transaction_id_set() TO authenticated, service_role;

DROP POLICY IF EXISTS "Read permitted escrow splits" ON public.escrow_splits;

CREATE POLICY "Read permitted escrow splits"
ON public.escrow_splits
FOR SELECT
TO authenticated
USING (
  escrow_transaction_id IN (SELECT public.readable_escrow_transaction_id_set())
);

DROP FUNCTION IF EXISTS public.readable_escrow_transaction_ids();