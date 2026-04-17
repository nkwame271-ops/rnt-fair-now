
ALTER TABLE public.payment_receipts
  ADD COLUMN IF NOT EXISTS admin_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS admin_confirmed_by uuid;

DROP POLICY IF EXISTS "Admins can confirm receipts" ON public.payment_receipts;
CREATE POLICY "Admins can confirm receipts"
ON public.payment_receipts
FOR UPDATE
TO authenticated
USING (public.is_main_admin(auth.uid()) OR public.has_role(auth.uid(), 'regulator'::app_role))
WITH CHECK (public.is_main_admin(auth.uid()) OR public.has_role(auth.uid(), 'regulator'::app_role));
