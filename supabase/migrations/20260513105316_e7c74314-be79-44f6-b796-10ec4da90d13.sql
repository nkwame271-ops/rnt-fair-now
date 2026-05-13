
-- 0. Relax status check so 'tenant_paid' (used by the payment finalizer) is valid
ALTER TABLE public.rent_payments DROP CONSTRAINT IF EXISTS rent_payments_status_check;
ALTER TABLE public.rent_payments
  ADD CONSTRAINT rent_payments_status_check
  CHECK (status = ANY (ARRAY['pending','submitted','tenant_paid','confirmed','overdue']));

-- 1. Atomic rent-increase approval (admin/super only)
CREATE OR REPLACE FUNCTION public.approve_rent_increase_request(
  p_request_id uuid,
  p_reviewer uuid,
  p_reviewer_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_old_rent numeric;
BEGIN
  IF NOT public.is_main_admin(p_reviewer) THEN
    RAISE EXCEPTION 'Only main or super admins can approve rent increases';
  END IF;

  SELECT * INTO r FROM public.rent_increase_requests WHERE id = p_request_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request % not found', p_request_id; END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (current status: %)', r.status;
  END IF;

  v_old_rent := COALESCE(r.current_approved_rent, 0);

  UPDATE public.rent_increase_requests
  SET status = 'approved',
      reviewer_user_id = p_reviewer,
      reviewer_notes = COALESCE(p_reviewer_notes, reviewer_notes),
      reviewed_at = now()
  WHERE id = p_request_id;

  IF r.unit_id IS NOT NULL THEN
    UPDATE public.units
    SET monthly_rent = r.proposed_rent,
        asking_rent = r.proposed_rent,
        rent_locked_at = now(),
        rent_locked_amount = r.proposed_rent
    WHERE id = r.unit_id;

    UPDATE public.tenancies
    SET agreed_rent = r.proposed_rent
    WHERE unit_id = r.unit_id
      AND status IN ('active', 'pending', 'renewal_window', 'existing_declared');
  END IF;

  IF r.property_id IS NOT NULL THEN
    UPDATE public.properties
    SET approved_rent = r.proposed_rent,
        rent_locked_at = now(),
        rent_locked_amount = r.proposed_rent
    WHERE id = r.property_id;

    INSERT INTO public.property_events (
      property_id, event_type, old_value, new_value, performed_by, reason
    ) VALUES (
      r.property_id,
      'rent_update',
      jsonb_build_object('rent', v_old_rent, 'effective_until', now()),
      jsonb_build_object('rent', r.proposed_rent, 'effective_from', now(), 'request_id', r.id),
      p_reviewer,
      'Rent increase approved' || CASE WHEN p_reviewer_notes IS NOT NULL AND length(p_reviewer_notes) > 0 THEN ': ' || p_reviewer_notes ELSE '' END
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', r.id, 'new_rent', r.proposed_rent);
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_rent_increase_request(uuid, uuid, text) TO authenticated;

-- 2. Backfill rent history for already-approved requests missing the property_event row
INSERT INTO public.property_events (property_id, event_type, old_value, new_value, performed_by, reason, created_at)
SELECT
  rir.property_id,
  'rent_update',
  jsonb_build_object('rent', rir.current_approved_rent),
  jsonb_build_object('rent', rir.proposed_rent, 'request_id', rir.id, 'backfilled', true),
  rir.reviewer_user_id,
  'Rent increase approved (backfilled from rent review)',
  COALESCE(rir.reviewed_at, rir.created_at)
FROM public.rent_increase_requests rir
WHERE rir.status = 'approved'
  AND rir.property_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.property_events pe
    WHERE pe.property_id = rir.property_id
      AND pe.event_type = 'rent_update'
      AND (pe.new_value->>'request_id') = rir.id::text
  );

-- 3. Repair completed bulk tax payments where rent_payments rows were never marked paid.
--    DISTINCT ON ensures each payment row is updated at most once even when multiple
--    completed escrow transactions reference the same payment id.
WITH completed_bulk AS (
  SELECT DISTINCT ON (payment_id)
    payment_id,
    completed_at,
    paystack_transaction_id
  FROM (
    SELECT
      jsonb_array_elements_text(COALESCE(et.metadata->'paymentIds', '[]'::jsonb))::uuid AS payment_id,
      et.completed_at,
      et.paystack_transaction_id
    FROM public.escrow_transactions et
    WHERE et.payment_type IN ('rent_tax', 'rent_tax_bulk')
      AND et.status = 'completed'
  ) s
  ORDER BY payment_id, completed_at DESC NULLS LAST
)
UPDATE public.rent_payments rp
SET tenant_marked_paid = true,
    status = 'tenant_paid',
    paid_date = COALESCE(rp.paid_date, cb.completed_at, now()),
    payment_method = COALESCE(rp.payment_method, 'Paystack'),
    receiver = COALESCE(rp.receiver, cb.paystack_transaction_id, '')
FROM completed_bulk cb
WHERE rp.id = cb.payment_id
  AND rp.tenant_marked_paid = false;

-- Mark tenancies tax-verified where any of their rent_payments are now paid
UPDATE public.tenancies t
SET tax_compliance_status = 'verified'
WHERE t.tax_compliance_status <> 'verified'
  AND EXISTS (
    SELECT 1 FROM public.rent_payments rp
    WHERE rp.tenancy_id = t.id
      AND (rp.tenant_marked_paid OR rp.landlord_confirmed OR rp.status IN ('tenant_paid','confirmed'))
  );

-- 4. NUGS sub-admin access to rent card stock + assignment history
DROP POLICY IF EXISTS "NUGS staff read serial stock" ON public.rent_card_serial_stock;
CREATE POLICY "NUGS staff read serial stock"
  ON public.rent_card_serial_stock
  FOR SELECT
  TO authenticated
  USING (public.is_nugs_user(auth.uid()));

DROP POLICY IF EXISTS "NUGS staff read serial assignments" ON public.serial_assignments;
CREATE POLICY "NUGS staff read serial assignments"
  ON public.serial_assignments
  FOR SELECT
  TO authenticated
  USING (public.is_nugs_user(auth.uid()));

GRANT EXECUTE ON FUNCTION public.assign_serials_atomic(jsonb, text, text, uuid) TO authenticated;
