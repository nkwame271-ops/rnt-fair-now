
-- Drift audit table
CREATE TABLE IF NOT EXISTS public.receipt_generation_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_transaction_id uuid,
  case_payment_id uuid,
  payment_reference text,
  failure_stage text NOT NULL,
  failure_reason text,
  attempted_payload jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rgf_unresolved ON public.receipt_generation_failures (resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rgf_reference ON public.receipt_generation_failures (payment_reference);

ALTER TABLE public.receipt_generation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read receipt failures"
  ON public.receipt_generation_failures FOR SELECT
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Admins update receipt failures"
  ON public.receipt_generation_failures FOR UPDATE
  USING (public.is_main_admin(auth.uid()));

-- Drift detector (read-only, used by Command Center tile and monitor)
CREATE OR REPLACE FUNCTION public.detect_receipt_drift()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_missing_receipts int;
  v_missing_receipt_numbers int;
  v_unreconciled int;
  v_recent_failures int;
BEGIN
  SELECT count(*) INTO v_missing_receipts
  FROM escrow_transactions et
  WHERE et.status IN ('success','completed','paid')
    AND et.created_at < now() - interval '5 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM payment_receipts pr WHERE pr.escrow_transaction_id = et.id
    );

  SELECT count(*) INTO v_missing_receipt_numbers
  FROM case_payments cp
  WHERE cp.payment_status = 'paid'
    AND cp.paid_at < now() - interval '5 minutes'
    AND cp.receipt_number IS NULL;

  SELECT count(*) INTO v_unreconciled
  FROM case_payments cp
  WHERE cp.payment_status = 'paid'
    AND cp.paid_at < now() - interval '5 minutes'
    AND (cp.reconciliation_status IS NULL OR cp.reconciliation_status <> 'reconciled');

  SELECT count(*) INTO v_recent_failures
  FROM receipt_generation_failures
  WHERE resolved = false
    AND created_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'missing_receipts', v_missing_receipts,
    'missing_receipt_numbers', v_missing_receipt_numbers,
    'unreconciled', v_unreconciled,
    'open_failures_24h', v_recent_failures,
    'checked_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.detect_receipt_drift() TO authenticated, service_role;
