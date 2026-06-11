CREATE OR REPLACE FUNCTION public.detect_receipt_drift()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    AND (et.metadata->>'parent_reference') IS NULL
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
$function$;