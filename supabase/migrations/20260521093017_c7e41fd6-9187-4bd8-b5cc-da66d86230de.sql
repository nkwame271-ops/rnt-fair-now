-- 1) Backfill missing case_payments rows from any paid escrow_transactions
INSERT INTO public.case_payments (
  case_id, student_id, payer_user_id, office_id, escrow_transaction_id,
  payment_reference, payment_provider, payment_type, amount_paid, currency,
  payment_status, reconciliation_status, paid_at, reconciled_at,
  ledger_entry_id, metadata, created_at
)
SELECT
  et.case_id,
  CASE WHEN et.is_student_revenue OR lower(COALESCE(et.office_id,'')) LIKE 'nugs%' THEN et.user_id ELSE NULL END,
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
  jsonb_build_object(
    'backfilled_from_escrow', true,
    'backfilled_at', to_jsonb(now()),
    'ledger_target',
      CASE WHEN et.is_student_revenue OR lower(COALESCE(et.office_id,'')) LIKE 'nugs%'
           THEN 'student_revenue' ELSE 'office_revenue' END
  ),
  et.created_at
FROM public.escrow_transactions et
WHERE et.status IN ('completed','success','paid')
  AND et.reference IS NOT NULL
ON CONFLICT (payment_reference) DO NOTHING;

-- 2) Backfill receipt_number / receipt_url on unified payments from existing receipts
UPDATE public.case_payments cp
SET receipt_number = COALESCE(cp.receipt_number, pr.receipt_number),
    receipt_url = COALESCE(
      cp.receipt_url,
      'https://rentcontrolghana.com/verify/receipt/' || cp.payment_reference
    )
FROM public.payment_receipts pr
WHERE pr.escrow_transaction_id = cp.escrow_transaction_id
  AND (cp.receipt_number IS NULL OR cp.receipt_url IS NULL);

-- Even when no receipt exists yet, ensure verification URL is set so QR works
UPDATE public.case_payments
SET receipt_url = 'https://rentcontrolghana.com/verify/receipt/' || payment_reference
WHERE receipt_url IS NULL
  AND payment_status = 'paid';

-- 3) Backfill case_id on historical receipts using cases.related_complaint_id
UPDATE public.payment_receipts pr
SET case_id = c.id
FROM public.escrow_transactions et
JOIN public.cases c ON c.related_complaint_id = et.related_complaint_id
WHERE pr.case_id IS NULL
  AND pr.escrow_transaction_id = et.id
  AND et.related_complaint_id IS NOT NULL;

-- 4) Re-run one-time reconciliation for paid-but-never-reconciled rows
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT payment_reference
    FROM public.case_payments
    WHERE payment_status = 'paid'
      AND (reconciliation_status <> 'reconciled' OR ledger_entry_id IS NULL)
  LOOP
    BEGIN
      PERFORM public.reconcile_case_payment(r.payment_reference, NULL, 'Backfill repair');
    EXCEPTION WHEN OTHERS THEN
      -- Skip rows that legitimately cannot reconcile; the idempotent RPC logs failures.
      NULL;
    END;
  END LOOP;
END $$;