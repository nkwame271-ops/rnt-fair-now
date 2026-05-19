-- Enum for AI verdict
DO $$ BEGIN
  CREATE TYPE public.payment_proof_ai_verdict AS ENUM (
    'pending',
    'ai_verified_high_confidence',
    'needs_admin_review',
    'ai_rejected_paystack_says_unpaid',
    'ai_rejected_appears_fake'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_proof_submission_status AS ENUM (
    'pending_ai_review',
    'awaiting_admin',
    'approved',
    'rejected',
    'info_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.payment_proof_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  service_type text NOT NULL,
  related_case_id uuid,
  related_property_id uuid,
  claimed_amount numeric,
  claimed_reference text,
  claimed_paid_at timestamptz,
  notes text,
  proof_file_path text NOT NULL,
  ai_verdict public.payment_proof_ai_verdict NOT NULL DEFAULT 'pending',
  ai_confidence numeric,
  ai_extracted_fields jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  paystack_lookup_status text,
  paystack_lookup_response jsonb,
  submission_status public.payment_proof_submission_status NOT NULL DEFAULT 'pending_ai_review',
  reviewed_by_admin_id uuid,
  reviewed_at timestamptz,
  review_decision text,
  review_notes text,
  resulting_fulfillment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pps_user ON public.payment_proof_submissions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pps_status ON public.payment_proof_submissions(submission_status, created_at DESC);

ALTER TABLE public.payment_proof_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own proof submissions"
  ON public.payment_proof_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view their own proof submissions"
  ON public.payment_proof_submissions FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.has_payment_permission(auth.uid(), 'reconcile_payment')
  );

CREATE POLICY "Admins update proof submissions"
  ON public.payment_proof_submissions FOR UPDATE
  USING (public.has_payment_permission(auth.uid(), 'reconcile_payment'));

CREATE TRIGGER trg_pps_updated_at
  BEFORE UPDATE ON public.payment_proof_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload their own payment proofs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users read their own payment proofs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-proofs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_payment_permission(auth.uid(), 'reconcile_payment')
    )
  );