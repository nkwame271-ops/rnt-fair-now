
ALTER TABLE public.complaint_basket_items
  ADD COLUMN IF NOT EXISTS is_nugs_revenue boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_scope text NOT NULL DEFAULT 'rent_control';

-- Allow NUGS users to manage basket items on student complaints from their school
DROP POLICY IF EXISTS "NUGS manages student basket items" ON public.complaint_basket_items;
CREATE POLICY "NUGS manages student basket items"
ON public.complaint_basket_items
FOR ALL
USING (
  complaint_table = 'complaints'
  AND public.is_nugs_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    JOIN public.tenants t ON t.user_id = c.tenant_user_id
    JOIN public.nugs_staff ns ON ns.user_id = auth.uid()
    WHERE c.id = complaint_basket_items.complaint_id
      AND t.is_student = true
      AND (ns.assigned_school IS NULL OR lower(t.school) = lower(ns.assigned_school))
  )
)
WITH CHECK (
  complaint_table = 'complaints'
  AND public.is_nugs_user(auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.complaints c
    JOIN public.tenants t ON t.user_id = c.tenant_user_id
    JOIN public.nugs_staff ns ON ns.user_id = auth.uid()
    WHERE c.id = complaint_basket_items.complaint_id
      AND t.is_student = true
      AND (ns.assigned_school IS NULL OR lower(t.school) = lower(ns.assigned_school))
  )
);
