
-- ============================================================
-- RentCare Assistance (CFLED-NUGS RentCare Common Fund)
-- ============================================================

-- 1. Status enum
DO $$ BEGIN
  CREATE TYPE public.rentcare_status AS ENUM (
    'draft',
    'awaiting_application_fee_payment',
    'paid_and_submitted',
    'awaiting_umb_account_number',
    'umb_account_submitted',
    'under_cfled_review',
    'under_nugs_validation',
    'sent_to_umb',
    'more_information_required',
    'approved',
    'declined',
    'disbursed',
    'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rentcare_payment_status AS ENUM (
    'unpaid','pending','paid','failed','reconciled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Reference sequence + generator
CREATE SEQUENCE IF NOT EXISTS public.rentcare_reference_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_rentcare_reference()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'RC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.rentcare_reference_seq')::text, 5, '0');
END;
$$;

-- 3. profiles: UMB account columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS umb_account_name text,
  ADD COLUMN IF NOT EXISTS umb_account_number text,
  ADD COLUMN IF NOT EXISTS umb_branch text,
  ADD COLUMN IF NOT EXISTS umb_account_type text,
  ADD COLUMN IF NOT EXISTS umb_account_created_on date,
  ADD COLUMN IF NOT EXISTS umb_confirmation_screenshot_path text,
  ADD COLUMN IF NOT EXISTS umb_submitted_at timestamptz;

-- 4. rentcare_applications
CREATE TABLE IF NOT EXISTS public.rentcare_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_user_id uuid NOT NULL,
  reference text NOT NULL UNIQUE DEFAULT public.generate_rentcare_reference(),
  status public.rentcare_status NOT NULL DEFAULT 'draft',
  payment_status public.rentcare_payment_status NOT NULL DEFAULT 'unpaid',
  payment_reference text,
  receipt_id uuid,
  fee_amount_snapshot numeric,
  -- Personal
  full_name text,
  phone text,
  email text,
  ghana_card_no text,
  gender text,
  region text,
  address text,
  -- Student
  institution text,
  campus text,
  student_id_code text,
  programme text,
  level text,
  -- Accommodation
  accommodation_type text,
  provider_name text,
  provider_contact text,
  accommodation_location text,
  total_fee numeric,
  amount_paid numeric,
  outstanding_amount numeric,
  amount_requested numeric,
  deadline date,
  -- Need
  reason text,
  urgency text,
  previous_support_history text,
  -- Guarantor / sponsor (optional)
  guarantor_json jsonb,
  -- Consent
  consent_accepted_at timestamptz,
  consent_ip text,
  -- UMB
  umb_account_name text,
  umb_account_number text,
  umb_branch text,
  umb_account_type text,
  umb_account_created_on date,
  umb_confirmation_screenshot_path text,
  umb_submitted_at timestamptz,
  -- Admin
  admin_notes text,
  decision_reason text,
  disbursed_at timestamptz,
  -- Concurrency
  version integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rentcare_app_user ON public.rentcare_applications(applicant_user_id);
CREATE INDEX IF NOT EXISTS idx_rentcare_app_status ON public.rentcare_applications(status);
CREATE INDEX IF NOT EXISTS idx_rentcare_app_reference ON public.rentcare_applications(reference);
CREATE INDEX IF NOT EXISTS idx_rentcare_app_payment_ref ON public.rentcare_applications(payment_reference);

ALTER TABLE public.rentcare_applications ENABLE ROW LEVEL SECURITY;

-- 5. documents
CREATE TABLE IF NOT EXISTS public.rentcare_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.rentcare_applications(id) ON DELETE CASCADE,
  uploader_user_id uuid NOT NULL,
  doc_type text NOT NULL, -- student_id, admission_proof, invoice, umb_confirmation, other
  file_path text NOT NULL,
  file_name text,
  mime_type text,
  size_bytes integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rentcare_doc_app ON public.rentcare_documents(application_id);
ALTER TABLE public.rentcare_documents ENABLE ROW LEVEL SECURITY;

-- 6. status history
CREATE TABLE IF NOT EXISTS public.rentcare_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.rentcare_applications(id) ON DELETE CASCADE,
  previous_status public.rentcare_status,
  new_status public.rentcare_status NOT NULL,
  changed_by uuid,
  changed_by_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rentcare_status_app ON public.rentcare_status_history(application_id);
ALTER TABLE public.rentcare_status_history ENABLE ROW LEVEL SECURITY;

-- 7. messages
CREATE TABLE IF NOT EXISTS public.rentcare_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.rentcare_applications(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_role text NOT NULL,
  subject text,
  body text NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rentcare_msg_app ON public.rentcare_messages(application_id);
ALTER TABLE public.rentcare_messages ENABLE ROW LEVEL SECURITY;

-- 8. audit log
CREATE TABLE IF NOT EXISTS public.rentcare_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid REFERENCES public.rentcare_applications(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  actor_role text,
  old_value jsonb,
  new_value jsonb,
  ip text,
  device text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rentcare_audit_app ON public.rentcare_audit_log(application_id);
CREATE INDEX IF NOT EXISTS idx_rentcare_audit_event ON public.rentcare_audit_log(event_type);
ALTER TABLE public.rentcare_audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Triggers
-- ============================================================

-- Touch updated_at + bump version on update
CREATE OR REPLACE FUNCTION public.rentcare_apps_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    NEW.version := COALESCE(OLD.version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rentcare_apps_touch ON public.rentcare_applications;
CREATE TRIGGER trg_rentcare_apps_touch
BEFORE UPDATE ON public.rentcare_applications
FOR EACH ROW EXECUTE FUNCTION public.rentcare_apps_touch();

-- Log status change
CREATE OR REPLACE FUNCTION public.rentcare_apps_status_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT CASE
             WHEN public.is_super_admin(auth.uid()) THEN 'super_admin'
             WHEN public.is_main_admin(auth.uid()) THEN 'admin'
             WHEN public.is_nugs_user(auth.uid()) THEN 'nugs'
             ELSE 'student'
           END INTO v_role;
    INSERT INTO public.rentcare_status_history (application_id, previous_status, new_status, changed_by, changed_by_role)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid(), v_role);
    INSERT INTO public.rentcare_audit_log (application_id, event_type, actor_user_id, actor_role, old_value, new_value)
    VALUES (NEW.id, 'status_changed', auth.uid(), v_role,
            jsonb_build_object('status', OLD.status),
            jsonb_build_object('status', NEW.status));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rentcare_apps_status_log ON public.rentcare_applications;
CREATE TRIGGER trg_rentcare_apps_status_log
AFTER UPDATE ON public.rentcare_applications
FOR EACH ROW EXECUTE FUNCTION public.rentcare_apps_status_log();

-- ============================================================
-- RLS policies
-- ============================================================

-- rentcare_applications
DROP POLICY IF EXISTS "Student reads own application" ON public.rentcare_applications;
CREATE POLICY "Student reads own application" ON public.rentcare_applications
  FOR SELECT TO authenticated
  USING (applicant_user_id = auth.uid()
         OR public.is_main_admin(auth.uid())
         OR public.is_super_admin(auth.uid())
         OR public.is_nugs_user(auth.uid()));

DROP POLICY IF EXISTS "Student inserts own draft" ON public.rentcare_applications;
CREATE POLICY "Student inserts own draft" ON public.rentcare_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_user_id = auth.uid());

DROP POLICY IF EXISTS "Student updates own draft or UMB" ON public.rentcare_applications;
CREATE POLICY "Student updates own draft or UMB" ON public.rentcare_applications
  FOR UPDATE TO authenticated
  USING (applicant_user_id = auth.uid()
         AND status IN ('draft','awaiting_application_fee_payment','awaiting_umb_account_number','more_information_required'))
  WITH CHECK (applicant_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins/NUGS update applications" ON public.rentcare_applications;
CREATE POLICY "Admins/NUGS update applications" ON public.rentcare_applications
  FOR UPDATE TO authenticated
  USING (public.is_main_admin(auth.uid())
         OR public.is_super_admin(auth.uid())
         OR public.is_nugs_user(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid())
              OR public.is_super_admin(auth.uid())
              OR public.is_nugs_user(auth.uid()));

-- rentcare_documents
DROP POLICY IF EXISTS "Read app docs" ON public.rentcare_documents;
CREATE POLICY "Read app docs" ON public.rentcare_documents
  FOR SELECT TO authenticated
  USING (
    uploader_user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rentcare_applications a
               WHERE a.id = application_id AND a.applicant_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.is_nugs_user(auth.uid())
  );

DROP POLICY IF EXISTS "Insert own app docs" ON public.rentcare_documents;
CREATE POLICY "Insert own app docs" ON public.rentcare_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploader_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.rentcare_applications a
                WHERE a.id = application_id AND a.applicant_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Delete own app docs" ON public.rentcare_documents;
CREATE POLICY "Delete own app docs" ON public.rentcare_documents
  FOR DELETE TO authenticated
  USING (uploader_user_id = auth.uid()
         AND EXISTS (SELECT 1 FROM public.rentcare_applications a
                     WHERE a.id = application_id AND a.applicant_user_id = auth.uid()
                     AND a.status IN ('draft','awaiting_application_fee_payment','more_information_required')));

-- status history (read-only)
DROP POLICY IF EXISTS "Read status history" ON public.rentcare_status_history;
CREATE POLICY "Read status history" ON public.rentcare_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rentcare_applications a
            WHERE a.id = application_id AND a.applicant_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.is_nugs_user(auth.uid())
  );

-- messages
DROP POLICY IF EXISTS "Read messages" ON public.rentcare_messages;
CREATE POLICY "Read messages" ON public.rentcare_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.rentcare_applications a
            WHERE a.id = application_id AND a.applicant_user_id = auth.uid())
    OR public.is_main_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.is_nugs_user(auth.uid())
  );

DROP POLICY IF EXISTS "Send messages" ON public.rentcare_messages;
CREATE POLICY "Send messages" ON public.rentcare_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_user_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.rentcare_applications a
              WHERE a.id = application_id AND a.applicant_user_id = auth.uid())
      OR public.is_main_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR public.is_nugs_user(auth.uid())
    )
  );

-- audit log
DROP POLICY IF EXISTS "Admins read audit" ON public.rentcare_audit_log;
CREATE POLICY "Admins read audit" ON public.rentcare_audit_log
  FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid())
         OR public.is_super_admin(auth.uid())
         OR public.is_nugs_user(auth.uid()));

DROP POLICY IF EXISTS "Anyone inserts own audit row" ON public.rentcare_audit_log;
CREATE POLICY "Anyone inserts own audit row" ON public.rentcare_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid() OR actor_user_id IS NULL);

-- ============================================================
-- Admin update RPC (optimistic locking, whitelisted fields)
-- ============================================================
CREATE OR REPLACE FUNCTION public.rentcare_admin_update(
  p_application_id uuid,
  p_expected_version integer,
  p_patch jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_key text;
  v_value text;
  v_sql text;
  v_row jsonb;
  v_keys text[];
BEGIN
  IF NOT (public.is_main_admin(auth.uid())
          OR public.is_super_admin(auth.uid())
          OR public.is_nugs_user(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_patch)
  LOOP
    IF v_key NOT IN ('status','admin_notes','decision_reason','disbursed_at') THEN
      RAISE EXCEPTION 'Field % is not allowed via rentcare_admin_update', v_key;
    END IF;
  END LOOP;

  SELECT version INTO v_current FROM public.rentcare_applications
   WHERE id = p_application_id FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Application % not found', p_application_id;
  END IF;

  IF v_current <> p_expected_version THEN
    RETURN jsonb_build_object('ok', false, 'code', 'STALE_VERSION',
                              'expected', p_expected_version, 'actual', v_current);
  END IF;

  SELECT array_agg(quote_ident(k)) INTO v_keys FROM jsonb_object_keys(p_patch) k;
  IF v_keys IS NULL OR array_length(v_keys, 1) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'row', to_jsonb((SELECT a.* FROM public.rentcare_applications a WHERE a.id = p_application_id)));
  END IF;

  v_sql := format(
    'UPDATE public.rentcare_applications SET (%s) = (SELECT %s FROM jsonb_populate_record(null::public.rentcare_applications, $1)) WHERE id = $2 RETURNING to_jsonb(rentcare_applications.*)',
    array_to_string(v_keys, ','),
    array_to_string(v_keys, ',')
  );
  EXECUTE v_sql INTO v_row USING p_patch, p_application_id;
  RETURN jsonb_build_object('ok', true, 'row', v_row);
END;
$$;

-- ============================================================
-- Storage bucket: rentcare-docs (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('rentcare-docs', 'rentcare-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rentcare docs read" ON storage.objects;
CREATE POLICY "rentcare docs read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'rentcare-docs'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.is_main_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
      OR public.is_nugs_user(auth.uid())
    )
  );

DROP POLICY IF EXISTS "rentcare docs insert" ON storage.objects;
CREATE POLICY "rentcare docs insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rentcare-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "rentcare docs delete" ON storage.objects;
CREATE POLICY "rentcare docs delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'rentcare-docs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Feature flags + split config seed
-- ============================================================
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled, category, fee_amount, fee_enabled)
VALUES
  ('rentcare_assistance', 'RentCare Assistance', 'CFLED-NUGS RentCare Common Fund. Student aid application programme.', true, 'student', 75, true),
  ('rentcare_allow_umb_edit', 'RentCare: Allow UMB Edit After Submission', 'When ON, students may correct their UMB account details after first submission.', false, 'general', null, false),
  ('rentcare_admin_export_enabled', 'RentCare: Admin Exports Enabled', 'When ON, admins can export applications to PDF, CSV, and Excel.', true, 'general', null, false),
  ('rentcare_umb_link', 'RentCare: UMB Account Creation Link', 'https://www.umbbank.com/open-account', true, 'general', null, false)
ON CONFLICT (feature_key) DO NOTHING;

INSERT INTO public.split_configurations (payment_type, recipient, amount, description, sort_order)
SELECT 'rentcare_application_fee', 'admin', 100, 'RentCare application processing fee', 1
WHERE NOT EXISTS (
  SELECT 1 FROM public.split_configurations WHERE payment_type = 'rentcare_application_fee'
);
