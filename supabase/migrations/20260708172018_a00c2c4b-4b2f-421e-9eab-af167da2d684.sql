
-- New feature flags for Engine Room configurability
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category, fee_amount, fee_enabled) VALUES
  ('property_assessment', 'Property Assessment Fee', 'Fee charged when a landlord or tenant requests a habitability inspection.', true, 'assessments', 150, true),
  ('premium_service_landlord', 'Premium Service (Landlord)', 'Per-property annual subscription giving landlords a dedicated agent and full management support.', true, 'premium', 600, true),
  ('premium_service_tenant', 'Premium Service (Tenant)', 'Per-tenant annual subscription giving tenants a dedicated agent and priority support.', true, 'premium', 240, true),
  ('wallet_topup', 'Wallet Top-up', 'Enable users to add money to their NAFLIS wallet.', true, 'wallet', 0, false),
  ('wallet_withdrawal', 'Wallet Withdrawal', 'Enable users to withdraw from their NAFLIS wallet to a payout account.', true, 'wallet', 0, false),
  ('wallet_send_money', 'Wallet Send Money', 'Enable peer-to-peer wallet transfers.', true, 'wallet', 0, false),
  ('wallet_payment_link', 'Wallet Payment Links', 'Enable users to create payment links to collect money.', true, 'wallet', 0, false),
  ('rent_card_download', 'Rent Card PDF Download', 'Allow landlords and tenants to download digital rent cards as PDF.', true, 'rent_cards', 0, false),
  ('safety_report', 'Safety Report Submission', 'Enable submission of tenant/landlord safety reports (including drug abuse).', true, 'safety', 0, false)
ON CONFLICT (feature_key) DO NOTHING;

-- Pending assessment drafts table: holds form data across checkout redirect
CREATE TABLE IF NOT EXISTS public.pending_assessment_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  requester_role text NOT NULL,
  reason text,
  fee_amount numeric NOT NULL DEFAULT 0,
  reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending_payment',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_assessment_drafts TO authenticated;
GRANT ALL ON public.pending_assessment_drafts TO service_role;

ALTER TABLE public.pending_assessment_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own assessment drafts"
  ON public.pending_assessment_drafts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pending_assessment_drafts_user ON public.pending_assessment_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_assessment_drafts_reference ON public.pending_assessment_drafts(reference);
