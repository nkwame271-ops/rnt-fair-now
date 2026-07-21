
CREATE OR REPLACE FUNCTION public.post_receipt_to_cashbook()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_ref TEXT; v_prev_balance NUMERIC(14,2); v_amount NUMERIC(14,2);
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' AND NEW.status IS DISTINCT FROM 'paid'
     AND NEW.status IS DISTINCT FROM 'issued' AND NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;
  v_ref := COALESCE(NEW.paystack_reference, NEW.platform_reference, NEW.receipt_number, NEW.id::text);
  v_amount := COALESCE(NEW.total_amount, 0);
  IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE payment_ref = v_ref) THEN RETURN NEW; END IF;
  SELECT running_balance INTO v_prev_balance FROM public.cashbook_entries
    ORDER BY entry_date DESC, created_at DESC LIMIT 1;
  v_prev_balance := COALESCE(v_prev_balance, 0);
  INSERT INTO public.cashbook_entries (
    entry_date, receipt_no, payment_ref, description, category, payer, office,
    channel, method, money_in, money_out, running_balance, reconciliation_status, source_receipt_id, metadata
  ) VALUES (
    COALESCE(NEW.payment_date, NEW.reconciliation_date, NEW.created_at, now()),
    NEW.receipt_number, v_ref,
    COALESCE(NEW.description, NEW.payment_type),
    COALESCE(NEW.service_type, NEW.payment_type, 'other'),
    NEW.payer_name, NEW.office_id, 'paystack', NEW.payment_method,
    v_amount, 0, v_prev_balance + v_amount,
    CASE WHEN NEW.reconciliation_date IS NOT NULL THEN 'reconciled' ELSE 'pending' END,
    NEW.id,
    jsonb_build_object('payment_type', NEW.payment_type, 'service_type', NEW.service_type,
                       'tenancy_id', NEW.tenancy_id, 'case_id', NEW.case_id));
  RETURN NEW;
END; $function$;

DO $$
DECLARE r RECORD; v_prev NUMERIC(14,2) := 0; v_ref TEXT; v_amt NUMERIC(14,2);
BEGIN
  SELECT COALESCE(running_balance, 0) INTO v_prev FROM public.cashbook_entries
    ORDER BY entry_date DESC, created_at DESC LIMIT 1;
  v_prev := COALESCE(v_prev, 0);
  FOR r IN SELECT * FROM public.payment_receipts
           WHERE status IN ('completed','paid','issued','active')
           ORDER BY COALESCE(payment_date, reconciliation_date, created_at) ASC
  LOOP
    v_ref := COALESCE(r.paystack_reference, r.platform_reference, r.receipt_number, r.id::text);
    IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE payment_ref = v_ref) THEN CONTINUE; END IF;
    v_amt := COALESCE(r.total_amount, 0);
    v_prev := v_prev + v_amt;
    INSERT INTO public.cashbook_entries (
      entry_date, receipt_no, payment_ref, description, category, payer, office,
      channel, method, money_in, money_out, running_balance, reconciliation_status, source_receipt_id, metadata
    ) VALUES (
      COALESCE(r.payment_date, r.reconciliation_date, r.created_at, now()),
      r.receipt_number, v_ref,
      COALESCE(r.description, r.payment_type),
      COALESCE(r.service_type, r.payment_type, 'other'),
      r.payer_name, r.office_id, 'paystack', r.payment_method,
      v_amt, 0, v_prev,
      CASE WHEN r.reconciliation_date IS NOT NULL THEN 'reconciled' ELSE 'pending' END,
      r.id,
      jsonb_build_object('payment_type', r.payment_type, 'service_type', r.service_type,
                         'tenancy_id', r.tenancy_id, 'case_id', r.case_id));
  END LOOP;
END $$;

UPDATE public.rent_cards rc
SET tenant_user_id = COALESCE(rc.tenant_user_id, t.tenant_user_id),
    unit_id = COALESCE(rc.unit_id, t.unit_id)
FROM public.tenancies t
WHERE rc.tenancy_id = t.id
  AND rc.tenancy_id IS NOT NULL
  AND (rc.tenant_user_id IS NULL OR rc.unit_id IS NULL);

UPDATE public.rent_cards rc
SET property_id = u.property_id
FROM public.units u
WHERE rc.unit_id = u.id
  AND rc.unit_id IS NOT NULL
  AND rc.property_id IS NULL;

INSERT INTO public.platform_config (config_key, config_value)
VALUES ('car_case_prefix', jsonb_build_object('prefix', 'CAR'))
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category, fee_enabled, fee_amount, fee_type, billing_frequency, payment_destination)
VALUES
  ('agent_program', 'Premium Service Agent Program', 'Public agent registration and portal', true, 'services', false, 0, 'fixed', 'one_time', 'platform'),
  ('digital_rent_card', 'Digital Rent Card', 'Issuance and display of digital rent cards', true, 'services', false, 0, 'fixed', 'one_time', 'platform'),
  ('rent_management_deduction', 'Rent Management Deduction', 'Fee taken when platform staff manage a landlord''s rent collection', true, 'fees', true, 5, 'percentage', 'monthly', 'platform'),
  ('wallet_withdrawal_fee', 'Wallet Withdrawal Fee', 'Fee charged on wallet withdrawals', true, 'fees', true, 1, 'fixed', 'one_time', 'platform'),
  ('safety_report', 'Safety & Drug Abuse Reporting', 'Enriched safety issue reporting with GPS, landmark, anonymous mode', true, 'services', false, 0, 'fixed', 'one_time', 'platform')
ON CONFLICT (feature_key) DO NOTHING;
