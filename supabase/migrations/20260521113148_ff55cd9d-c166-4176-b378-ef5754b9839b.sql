-- Layer 1: DB-level dedup guarantees
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_escrow_uniq
  ON public.payment_receipts(escrow_transaction_id)
  WHERE escrow_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payout_transfers_paystack_ref_uniq
  ON public.payout_transfers(paystack_reference)
  WHERE paystack_reference IS NOT NULL;

-- Advisory lock helper — used by edge functions to serialize finalize per reference,
-- preventing webhook + verify-payment + drift-monitor from racing on the same charge.
CREATE OR REPLACE FUNCTION public.try_finalize_lock(p_reference text)
RETURNS boolean
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_xact_lock(hashtextextended(p_reference, 0));
$$;