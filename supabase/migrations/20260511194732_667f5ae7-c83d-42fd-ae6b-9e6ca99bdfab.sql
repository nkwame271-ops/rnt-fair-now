-- Repair orphaned rent cards: tenancy_id was cleared by prior cleanup but other linked fields left dangling
UPDATE public.rent_cards
SET tenant_user_id = NULL,
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
WHERE tenancy_id IS NULL
  AND tenant_user_id IS NOT NULL;

-- Also catch any rent_cards still pointing at a tenancy row that no longer exists
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
    status = CASE WHEN rc.serial_number IS NOT NULL THEN 'valid' ELSE 'awaiting_serial' END
WHERE rc.tenancy_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.tenancies t WHERE t.id = rc.tenancy_id);