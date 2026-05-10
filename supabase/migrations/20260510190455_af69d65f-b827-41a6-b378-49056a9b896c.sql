
-- 1) Placeholder fields on tenancies for "declared existing tenancy" before tenant registers
ALTER TABLE public.tenancies
  ALTER COLUMN tenant_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS placeholder_tenant_name text,
  ADD COLUMN IF NOT EXISTS placeholder_tenant_phone text,
  ADD COLUMN IF NOT EXISTS pending_tenant_id uuid;

CREATE INDEX IF NOT EXISTS idx_tenancies_pending_tenant ON public.tenancies(pending_tenant_id) WHERE pending_tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tenancies_placeholder_phone ON public.tenancies(placeholder_tenant_phone) WHERE placeholder_tenant_phone IS NOT NULL;

-- 2) When a NUGS office assigns a rent card, classify revenue under Student Revenue with 4-way split.
CREATE OR REPLACE FUNCTION public.classify_nugs_rent_card_revenue(p_office_id text, p_card_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_nugs boolean;
  v_purchase_ids uuid[];
BEGIN
  -- Detect NUGS office by id prefix or office type flag (offices.is_nugs if exists)
  SELECT (lower(p_office_id) LIKE 'nugs%') INTO v_is_nugs;
  IF NOT v_is_nugs THEN RETURN; END IF;

  -- Find escrow_transactions tied to these card purchases (via rent_cards.purchase_id chain or related_property_id)
  -- Match by metadata->>'card_ids' contains any, or by related card purchase reference
  UPDATE public.escrow_transactions et
  SET is_student_revenue = true,
      payment_type = 'student_rent_card_fee',
      office_id = NULL,
      metadata = COALESCE(metadata, '{}'::jsonb)
        || jsonb_build_object(
             'reclassified_as_student_revenue', true,
             'reclassified_at', to_jsonb(now()),
             'reclassified_reason', 'NUGS office assigned rent card',
             'nugs_office_id', p_office_id
           )
  WHERE et.payment_type IN ('rent_card_fee','rent_card_purchase')
    AND (
      EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(COALESCE(et.metadata->'card_ids','[]'::jsonb)) AS c(id)
        WHERE c.id::uuid = ANY(p_card_ids)
      )
      OR EXISTS (
        SELECT 1 FROM public.rent_cards rc
        WHERE rc.id = ANY(p_card_ids) AND rc.purchase_id IS NOT NULL
          AND et.reference LIKE '%' || rc.purchase_id || '%'
      )
    );
END;
$$;
