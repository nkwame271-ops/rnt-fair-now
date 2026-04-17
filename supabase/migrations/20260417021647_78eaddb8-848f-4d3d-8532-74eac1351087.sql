ALTER TABLE public.escrow_splits
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','superseded')),
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correction_run_id UUID,
  ADD COLUMN IF NOT EXISTS payout_readiness TEXT NOT NULL DEFAULT 'pending'
    CHECK (payout_readiness IN ('pending','ready','unassigned','released','failed'));

CREATE INDEX IF NOT EXISTS idx_escrow_splits_active
  ON public.escrow_splits (escrow_transaction_id, status);

CREATE INDEX IF NOT EXISTS idx_escrow_splits_correction_run
  ON public.escrow_splits (correction_run_id) WHERE correction_run_id IS NOT NULL;