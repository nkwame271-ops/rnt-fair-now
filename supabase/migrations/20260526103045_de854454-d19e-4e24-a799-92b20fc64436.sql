
-- Drafts table for paid safety reports
CREATE TABLE IF NOT EXISTS public.pending_safety_report_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_role text NOT NULL CHECK (user_role IN ('tenant','landlord','student')),
  payload jsonb NOT NULL,
  evidence_paths text[] DEFAULT '{}'::text[],
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_payment',
  reference text,
  materialized_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_psrd_user ON public.pending_safety_report_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_psrd_reference ON public.pending_safety_report_drafts(reference);

ALTER TABLE public.pending_safety_report_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own safety drafts"
  ON public.pending_safety_report_drafts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role manages safety drafts"
  ON public.pending_safety_report_drafts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER trg_psrd_updated_at
  BEFORE UPDATE ON public.pending_safety_report_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default split configurations for Safety Report Fee (tenant/landlord 3-way)
INSERT INTO public.split_configurations (payment_type, recipient, amount_type, amount, description, sort_order, is_platform_fee)
VALUES
  ('safety_report_fee', 'rent_control', 'flat', 2.00, 'IGF - Safety Report', 0, false),
  ('safety_report_fee', 'admin',        'flat', 1.50, 'Admin - Safety Report', 1, false),
  ('safety_report_fee', 'platform',     'flat', 1.50, 'Platform - Safety Report', 2, false),
  ('student_safety_report_fee', 'igf',      'flat', 0.00, 'IGF (Rent Control) - Student Safety Report', 0, false),
  ('student_safety_report_fee', 'nugs',     'flat', 1.50, 'NUGS - Student Safety Report', 1, false),
  ('student_safety_report_fee', 'platform', 'flat', 2.50, 'Platform - Student Safety Report', 2, false),
  ('student_safety_report_fee', 'cm',       'flat', 1.00, 'Community Manager - Student Safety Report', 3, false)
ON CONFLICT DO NOTHING;
