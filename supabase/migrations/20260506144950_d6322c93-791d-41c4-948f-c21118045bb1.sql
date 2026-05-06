
-- 1. NUGS staff: features + freeze
ALTER TABLE public.nugs_staff
  ADD COLUMN IF NOT EXISTS allowed_features jsonb,
  ADD COLUMN IF NOT EXISTS muted_features jsonb,
  ADD COLUMN IF NOT EXISTS is_frozen boolean NOT NULL DEFAULT false;

-- 2. pending_complaint_drafts (payment-first model)
CREATE TABLE IF NOT EXISTS public.pending_complaint_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL,
  payload jsonb NOT NULL,
  evidence_paths text[] DEFAULT '{}',
  audio_path text,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_payment',
  reference text,
  materialized_complaint_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_pcd_tenant ON public.pending_complaint_drafts(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_pcd_reference ON public.pending_complaint_drafts(reference);

ALTER TABLE public.pending_complaint_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants manage own drafts" ON public.pending_complaint_drafts;
CREATE POLICY "Tenants manage own drafts" ON public.pending_complaint_drafts
  FOR ALL TO authenticated
  USING (tenant_user_id = auth.uid())
  WITH CHECK (tenant_user_id = auth.uid());

DROP POLICY IF EXISTS "Service role manages drafts" ON public.pending_complaint_drafts;
CREATE POLICY "Service role manages drafts" ON public.pending_complaint_drafts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_pcd_updated_at BEFORE UPDATE ON public.pending_complaint_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Complaints: custom type flag + nugs assignee
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complaint_type_is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_nugs_user_id uuid;

-- 4. Escrow transactions: NUGS office ref
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS nugs_office_id text;

-- 5. Seed split_configurations for NUGS-assigned rent cards
INSERT INTO public.split_configurations (payment_type, recipient, amount_type, amount, description, sort_order, is_platform_fee)
VALUES
  ('student_rent_card_fee', 'igf',      'percentage', 30, 'IGF (Rent Control)', 0, false),
  ('student_rent_card_fee', 'nugs',     'percentage', 50, 'NUGS office share',  1, false),
  ('student_rent_card_fee', 'cm',       'percentage', 10, 'CM',                  2, false),
  ('student_rent_card_fee', 'platform', 'percentage', 10, 'Platform',           3, true)
ON CONFLICT (payment_type, recipient, sort_order) DO NOTHING;

-- 6. Allow NUGS admins (admin_action target) - extend RLS context if needed (no-op if exists)
