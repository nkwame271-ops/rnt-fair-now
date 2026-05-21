
CREATE TABLE IF NOT EXISTS public.case_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  student_id uuid,
  payer_user_id uuid,
  office_id text,
  escrow_transaction_id uuid REFERENCES public.escrow_transactions(id) ON DELETE SET NULL,
  payment_reference text NOT NULL UNIQUE,
  payment_provider text NOT NULL DEFAULT 'paystack',
  payment_type text NOT NULL,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  payment_status text NOT NULL DEFAULT 'pending',
  reconciliation_status text NOT NULL DEFAULT 'unreconciled',
  receipt_number text,
  receipt_url text,
  paid_at timestamptz,
  reconciled_at timestamptz,
  reconciled_by uuid,
  ledger_entry_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT case_payments_status_chk CHECK (payment_status IN ('pending','paid','failed','refunded')),
  CONSTRAINT case_payments_recon_chk CHECK (reconciliation_status IN ('unreconciled','reconciled','failed'))
);

CREATE INDEX IF NOT EXISTS idx_case_payments_case_id ON public.case_payments(case_id);
CREATE INDEX IF NOT EXISTS idx_case_payments_student_id ON public.case_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_case_payments_payer ON public.case_payments(payer_user_id);
CREATE INDEX IF NOT EXISTS idx_case_payments_status ON public.case_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_case_payments_recon ON public.case_payments(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_case_payments_escrow ON public.case_payments(escrow_transaction_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_case_payments_case_type_paid
  ON public.case_payments(case_id, payment_type)
  WHERE payment_status = 'paid' AND case_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_case_payments_updated_at ON public.case_payments;
CREATE TRIGGER trg_case_payments_updated_at
  BEFORE UPDATE ON public.case_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.case_payment_reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_payment_id uuid REFERENCES public.case_payments(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  transaction_reference text,
  ledger_update_reference uuid,
  previous_status text,
  new_status text,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cp_recon_log_payment ON public.case_payment_reconciliation_log(case_payment_id);

CREATE OR REPLACE FUNCTION public.case_payments_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_service boolean := (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role');
BEGIN
  IF TG_OP = 'UPDATE' AND NOT is_service THEN
    IF NEW.ledger_entry_id IS DISTINCT FROM OLD.ledger_entry_id
       OR NEW.reconciliation_status IS DISTINCT FROM OLD.reconciliation_status
       OR NEW.reconciled_at IS DISTINCT FROM OLD.reconciled_at
       OR NEW.reconciled_by IS DISTINCT FROM OLD.reconciled_by
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.amount_paid IS DISTINCT FROM OLD.amount_paid THEN
      RAISE EXCEPTION 'case_payments reconciliation fields are read-only to clients';
    END IF;
  END IF;

  IF NEW.payment_status = 'paid' AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM 'paid') THEN
    IF NEW.receipt_number IS NULL THEN
      NEW.receipt_number := public.generate_receipt_number();
    END IF;
    IF NEW.paid_at IS NULL THEN
      NEW.paid_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_payments_guard ON public.case_payments;
CREATE TRIGGER trg_case_payments_guard
  BEFORE INSERT OR UPDATE ON public.case_payments
  FOR EACH ROW EXECUTE FUNCTION public.case_payments_guard();

CREATE OR REPLACE FUNCTION public.reconcile_case_payment(
  p_payment_reference text,
  p_actor uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.case_payments;
  v_ledger_id uuid;
  v_is_student boolean;
BEGIN
  SELECT * INTO v_row FROM public.case_payments
   WHERE payment_reference = p_payment_reference
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_reference;
  END IF;

  IF v_row.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'Payment % is not confirmed (status=%)', p_payment_reference, v_row.payment_status;
  END IF;

  IF v_row.reconciliation_status = 'reconciled' OR v_row.ledger_entry_id IS NOT NULL THEN
    INSERT INTO public.case_payment_reconciliation_log(
      case_payment_id, action, actor_id, transaction_reference,
      ledger_update_reference, previous_status, new_status, notes
    ) VALUES (
      v_row.id, 'idempotent_skip', p_actor, p_payment_reference,
      v_row.ledger_entry_id, v_row.reconciliation_status, v_row.reconciliation_status,
      COALESCE(p_notes, 'Transaction already reconciled')
    );
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'message', 'Transaction already reconciled',
      'case_payment_id', v_row.id,
      'ledger_entry_id', v_row.ledger_entry_id
    );
  END IF;

  v_is_student := (v_row.student_id IS NOT NULL)
                  OR (lower(COALESCE(v_row.office_id, '')) LIKE 'nugs%')
                  OR (v_row.payment_type = 'student_rent_card_fee');

  v_ledger_id := gen_random_uuid();

  UPDATE public.case_payments
  SET reconciliation_status = 'reconciled',
      reconciled_at = now(),
      reconciled_by = p_actor,
      ledger_entry_id = v_ledger_id,
      metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object(
                      'ledger_target', CASE WHEN v_is_student THEN 'student_revenue' ELSE 'office_revenue' END,
                      'reconciled_via', 'reconcile_case_payment'
                    )
  WHERE id = v_row.id;

  INSERT INTO public.case_payment_reconciliation_log(
    case_payment_id, action, actor_id, transaction_reference,
    ledger_update_reference, previous_status, new_status, notes
  ) VALUES (
    v_row.id, 'reconciled', p_actor, p_payment_reference,
    v_ledger_id, v_row.reconciliation_status, 'reconciled', p_notes
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'case_payment_id', v_row.id,
    'ledger_entry_id', v_ledger_id,
    'ledger_target', CASE WHEN v_is_student THEN 'student_revenue' ELSE 'office_revenue' END
  );
END;
$$;

ALTER TABLE public.case_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_payment_reconciliation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payer reads own case_payments" ON public.case_payments;
CREATE POLICY "payer reads own case_payments" ON public.case_payments
  FOR SELECT TO authenticated
  USING (payer_user_id = auth.uid() OR student_id = auth.uid());

DROP POLICY IF EXISTS "admins read all case_payments" ON public.case_payments;
CREATE POLICY "admins read all case_payments" ON public.case_payments
  FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.has_role(auth.uid(),'regulator'));

DROP POLICY IF EXISTS "admins read recon log" ON public.case_payment_reconciliation_log;
CREATE POLICY "admins read recon log" ON public.case_payment_reconciliation_log
  FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid()) OR public.has_role(auth.uid(),'regulator'));

INSERT INTO public.case_payments (
  case_id, student_id, payer_user_id, office_id, escrow_transaction_id,
  payment_reference, payment_provider, payment_type, amount_paid, currency,
  payment_status, reconciliation_status, paid_at, reconciled_at,
  ledger_entry_id, metadata, created_at
)
SELECT
  et.case_id,
  CASE WHEN et.is_student_revenue THEN et.user_id ELSE NULL END,
  et.user_id,
  et.office_id,
  et.id,
  et.reference,
  'paystack',
  et.payment_type,
  COALESCE(et.total_amount, 0),
  COALESCE(et.currency, 'GHS'),
  'paid',
  'reconciled',
  COALESCE(et.completed_at, et.created_at),
  COALESCE(et.completed_at, et.created_at),
  gen_random_uuid(),
  jsonb_build_object('backfilled_from_escrow', true, 'ledger_target',
    CASE WHEN et.is_student_revenue OR lower(COALESCE(et.office_id,'')) LIKE 'nugs%' THEN 'student_revenue' ELSE 'office_revenue' END),
  et.created_at
FROM public.escrow_transactions et
WHERE et.status IN ('completed','success','paid')
  AND et.reference IS NOT NULL
ON CONFLICT (payment_reference) DO NOTHING;

UPDATE public.case_payments cp
SET receipt_number = pr.receipt_number
FROM public.payment_receipts pr
WHERE (pr.platform_reference = cp.payment_reference OR pr.paystack_reference = cp.payment_reference)
  AND cp.receipt_number IS NULL;
