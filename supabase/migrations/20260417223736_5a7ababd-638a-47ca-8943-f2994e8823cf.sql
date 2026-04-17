-- 1. Basket items table
CREATE TABLE public.complaint_basket_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  complaint_table TEXT NOT NULL CHECK (complaint_table IN ('complaints','landlord_complaints')),
  complaint_type_id UUID NULL REFERENCES public.complaint_types(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('fee_rule','manual_adjustment')),
  label TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  igf_pct NUMERIC NOT NULL DEFAULT 0,
  admin_pct NUMERIC NOT NULL DEFAULT 100,
  platform_pct NUMERIC NOT NULL DEFAULT 0,
  computation_meta JSONB NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cbi_complaint ON public.complaint_basket_items(complaint_table, complaint_id);

ALTER TABLE public.complaint_basket_items ENABLE ROW LEVEL SECURITY;

-- Admins read/write
CREATE POLICY "Admins manage basket items"
ON public.complaint_basket_items
FOR ALL
USING (public.is_main_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()))
WITH CHECK (public.is_main_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- Tenant can view own
CREATE POLICY "Tenant views own basket items"
ON public.complaint_basket_items
FOR SELECT
USING (
  complaint_table = 'complaints' AND EXISTS (
    SELECT 1 FROM public.complaints c WHERE c.id = complaint_basket_items.complaint_id AND c.tenant_user_id = auth.uid()
  )
);

-- Landlord can view own
CREATE POLICY "Landlord views own basket items"
ON public.complaint_basket_items
FOR SELECT
USING (
  complaint_table = 'landlord_complaints' AND EXISTS (
    SELECT 1 FROM public.landlord_complaints lc WHERE lc.id = complaint_basket_items.complaint_id AND lc.landlord_user_id = auth.uid()
  )
);

-- 2. basket_total columns
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS basket_total NUMERIC NULL;
ALTER TABLE public.landlord_complaints ADD COLUMN IF NOT EXISTS basket_total NUMERIC NULL;

-- 3. escrow_splits linkage
ALTER TABLE public.escrow_splits ADD COLUMN IF NOT EXISTS complaint_basket_item_id UUID NULL;
CREATE INDEX IF NOT EXISTS idx_escrow_splits_basket_item ON public.escrow_splits(complaint_basket_item_id);
