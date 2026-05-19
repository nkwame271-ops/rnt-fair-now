
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complainant_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_complaints_complainant_user_id
  ON public.complaints(complainant_user_id);

DROP POLICY IF EXISTS "Complainant views own complaint" ON public.complaints;
CREATE POLICY "Complainant views own complaint"
  ON public.complaints FOR SELECT
  USING (auth.uid() = complainant_user_id);

DROP POLICY IF EXISTS "Complainant basket items" ON public.complaint_basket_items;
CREATE POLICY "Complainant basket items"
  ON public.complaint_basket_items FOR SELECT
  USING (
    complaint_table = 'complaints'
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id = complaint_basket_items.complaint_id
        AND c.complainant_user_id = auth.uid()
    )
  );
