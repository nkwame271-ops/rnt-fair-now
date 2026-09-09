SET LOCAL lock_timeout = '20s';
CREATE INDEX IF NOT EXISTS idx_escrow_created_at_desc ON public.escrow_transactions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_created_at_desc ON public.payment_receipts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_office_created ON public.payment_receipts (office_id, created_at DESC);
ANALYZE public.escrow_transactions;
ANALYZE public.payment_receipts;