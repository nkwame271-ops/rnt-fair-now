
-- Add paystack_recipient_code to system_settlement_accounts
ALTER TABLE public.system_settlement_accounts
ADD COLUMN IF NOT EXISTS paystack_recipient_code text;

-- Add paystack_recipient_code to office_payout_accounts
ALTER TABLE public.office_payout_accounts
ADD COLUMN IF NOT EXISTS paystack_recipient_code text;

-- Create payout_transfers table
CREATE TABLE public.payout_transfers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  escrow_split_id uuid REFERENCES public.escrow_splits(id) ON DELETE SET NULL,
  escrow_transaction_id uuid REFERENCES public.escrow_transactions(id) ON DELETE CASCADE NOT NULL,
  recipient_type text NOT NULL,
  recipient_code text,
  transfer_code text,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  paystack_reference text,
  failure_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.payout_transfers ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role manages payout transfers"
ON public.payout_transfers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Regulators can read for audit
CREATE POLICY "Regulators read payout transfers"
ON public.payout_transfers
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));

-- Index for fast lookup by escrow transaction
CREATE INDEX idx_payout_transfers_escrow_tx ON public.payout_transfers(escrow_transaction_id);

-- Index for webhook lookup by paystack_reference
CREATE INDEX idx_payout_transfers_paystack_ref ON public.payout_transfers(paystack_reference);
