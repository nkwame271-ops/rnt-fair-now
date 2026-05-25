
-- Phase 1 concurrency hardening: prevent duplicate fund requests / receipts
-- when paystack-webhook + verify-payment + drift-monitor race on the same reference.

CREATE UNIQUE INDEX IF NOT EXISTS office_fund_requests_payout_ref_uniq
  ON public.office_fund_requests (payout_reference)
  WHERE payout_reference IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_platform_ref_uniq
  ON public.payment_receipts (platform_reference)
  WHERE platform_reference IS NOT NULL;
