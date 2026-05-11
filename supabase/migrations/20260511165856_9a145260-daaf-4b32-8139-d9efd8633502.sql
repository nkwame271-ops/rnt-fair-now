
DROP POLICY IF EXISTS "NUGS admins read rent cards" ON public.rent_cards;
CREATE POLICY "NUGS admins read rent cards"
  ON public.rent_cards FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'nugs_admin'::app_role));

ALTER TABLE public.properties DISABLE TRIGGER USER;
ALTER TABLE public.units DISABLE TRIGGER USER;
ALTER TABLE public.tenancies DISABLE TRIGGER USER;

UPDATE public.units u
SET monthly_rent = rir.proposed_rent,
    rent_locked_at = COALESCE(u.rent_locked_at, rir.reviewed_at, now()),
    rent_locked_amount = rir.proposed_rent
FROM public.rent_increase_requests rir
WHERE rir.unit_id = u.id
  AND rir.status = 'approved'
  AND COALESCE(u.monthly_rent, 0) <> COALESCE(rir.proposed_rent, 0);

UPDATE public.tenancies t
SET agreed_rent = rir.proposed_rent
FROM public.rent_increase_requests rir
WHERE rir.unit_id = t.unit_id
  AND rir.status = 'approved'
  AND t.status IN ('active','pending','renewal_window','existing_declared')
  AND COALESCE(t.agreed_rent, 0) <> COALESCE(rir.proposed_rent, 0);

UPDATE public.properties p
SET approved_rent = rir.proposed_rent,
    rent_locked_at = COALESCE(p.rent_locked_at, rir.reviewed_at, now()),
    rent_locked_amount = rir.proposed_rent
FROM public.rent_increase_requests rir
WHERE rir.property_id = p.id
  AND rir.status = 'approved'
  AND COALESCE(p.approved_rent, 0) <> COALESCE(rir.proposed_rent, 0);

ALTER TABLE public.properties ENABLE TRIGGER USER;
ALTER TABLE public.units ENABLE TRIGGER USER;
ALTER TABLE public.tenancies ENABLE TRIGGER USER;

UPDATE public.rent_cards rc
SET tenancy_id = NULL,
    tenant_user_id = NULL,
    property_id = NULL,
    unit_id = NULL,
    start_date = NULL,
    expiry_date = NULL,
    current_rent = NULL,
    previous_rent = NULL,
    advance_paid = NULL,
    last_payment_status = NULL,
    activated_at = NULL,
    qr_token = NULL,
    status = CASE WHEN serial_number IS NOT NULL THEN 'valid' ELSE 'awaiting_serial' END
WHERE rc.tenancy_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.tenancies t WHERE t.id = rc.tenancy_id);
