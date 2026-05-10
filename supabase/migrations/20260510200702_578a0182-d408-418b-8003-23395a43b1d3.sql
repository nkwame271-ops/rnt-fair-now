
-- Enums
DO $$ BEGIN
  CREATE TYPE public.issue_type AS ENUM (
    'payment_not_updated','receipt_missing','rent_card_missing',
    'complaint_payment_missing','agreement_missing','wrong_dashboard_status','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.issue_service AS ENUM (
    'rent_card','complaint','agreement','receipt','tenancy','dashboard','payment','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.issue_status AS ENUM (
    'open','under_review','awaiting_user','resolved','rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Sequence for ticket numbers
CREATE SEQUENCE IF NOT EXISTS public.issue_ticket_seq;

CREATE OR REPLACE FUNCTION public.generate_issue_ticket()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN 'ISS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.issue_ticket_seq')::text, 5, '0');
END;$$;

-- issue_reports
CREATE TABLE IF NOT EXISTS public.issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL DEFAULT generate_issue_ticket(),
  reporter_user_id uuid NOT NULL,
  reporter_role text NOT NULL,
  issue_type issue_type NOT NULL,
  affected_service issue_service NOT NULL,
  reference_code text,
  description text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  contact_phone text,
  contact_email text,
  status issue_status NOT NULL DEFAULT 'open',
  assigned_admin_id uuid,
  resolution_summary text,
  resolved_at timestamptz,
  resolved_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issue_reports_reporter ON public.issue_reports(reporter_user_id);
CREATE INDEX IF NOT EXISTS idx_issue_reports_status ON public.issue_reports(status);
CREATE INDEX IF NOT EXISTS idx_issue_reports_created ON public.issue_reports(created_at DESC);

ALTER TABLE public.issue_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own reports" ON public.issue_reports;
CREATE POLICY "Users insert own reports" ON public.issue_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Users view own reports" ON public.issue_reports;
CREATE POLICY "Users view own reports" ON public.issue_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Super admins manage all reports" ON public.issue_reports;
CREATE POLICY "Super admins manage all reports" ON public.issue_reports
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Main admins read reports" ON public.issue_reports;
CREATE POLICY "Main admins read reports" ON public.issue_reports
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));

-- issue_messages
CREATE TABLE IF NOT EXISTS public.issue_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issue_reports(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_role text NOT NULL,
  body text NOT NULL,
  attachment_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_issue_messages_issue ON public.issue_messages(issue_id, created_at);

ALTER TABLE public.issue_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reporter views thread" ON public.issue_messages;
CREATE POLICY "Reporter views thread" ON public.issue_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.issue_reports r WHERE r.id = issue_id AND r.reporter_user_id = auth.uid()));

DROP POLICY IF EXISTS "Reporter posts in own thread" ON public.issue_messages;
CREATE POLICY "Reporter posts in own thread" ON public.issue_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_user_id AND EXISTS (
    SELECT 1 FROM public.issue_reports r WHERE r.id = issue_id AND r.reporter_user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Super admins manage thread" ON public.issue_messages;
CREATE POLICY "Super admins manage thread" ON public.issue_messages
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- issue_correction_log (immutable)
CREATE TABLE IF NOT EXISTS public.issue_correction_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES public.issue_reports(id) ON DELETE SET NULL,
  admin_user_id uuid NOT NULL,
  correction_type text NOT NULL,
  target_table text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  reason text NOT NULL,
  evidence_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_correction_log_issue ON public.issue_correction_log(issue_id);
CREATE INDEX IF NOT EXISTS idx_correction_log_admin ON public.issue_correction_log(admin_user_id);

ALTER TABLE public.issue_correction_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins view all corrections" ON public.issue_correction_log;
CREATE POLICY "Super admins view all corrections" ON public.issue_correction_log
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admins insert corrections" ON public.issue_correction_log;
CREATE POLICY "Super admins insert corrections" ON public.issue_correction_log
  FOR INSERT TO authenticated WITH CHECK (public.is_super_admin(auth.uid()) AND auth.uid() = admin_user_id);

DROP POLICY IF EXISTS "Main admins view corrections" ON public.issue_correction_log;
CREATE POLICY "Main admins view corrections" ON public.issue_correction_log
  FOR SELECT TO authenticated USING (public.is_main_admin(auth.uid()));

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_issue_reports_updated ON public.issue_reports;
CREATE TRIGGER trg_issue_reports_updated
  BEFORE UPDATE ON public.issue_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for evidence (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-evidence', 'issue-evidence', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own evidence" ON storage.objects;
CREATE POLICY "Users upload own evidence" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'issue-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users read own evidence" ON storage.objects;
CREATE POLICY "Users read own evidence" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'issue-evidence' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_super_admin(auth.uid())));

-- Repair function: retroactively provision rent cards for a paid escrow tx
CREATE OR REPLACE FUNCTION public.repair_rent_cards_for_escrow(p_escrow_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_escrow record;
  v_existing int;
  v_qty int;
  v_count int;
  v_purchase_id text;
  i int;
BEGIN
  SELECT * INTO v_escrow FROM escrow_transactions WHERE id = p_escrow_id;
  IF v_escrow IS NULL THEN RAISE EXCEPTION 'Escrow % not found', p_escrow_id; END IF;
  IF v_escrow.status NOT IN ('success','completed','paid') THEN
    RAISE EXCEPTION 'Escrow % is not in a paid state (status=%)', p_escrow_id, v_escrow.status;
  END IF;
  IF v_escrow.payment_type NOT IN ('rent_card','rent_card_bulk') THEN
    RAISE EXCEPTION 'Escrow % is not a rent card payment (type=%)', p_escrow_id, v_escrow.payment_type;
  END IF;

  SELECT count(*) INTO v_existing FROM rent_cards WHERE escrow_transaction_id = p_escrow_id;
  v_qty := COALESCE((v_escrow.metadata->>'quantity')::int, 1);
  v_count := v_qty * 2;
  IF v_existing >= v_count THEN
    RETURN jsonb_build_object('success', true, 'already_provisioned', true, 'existing', v_existing);
  END IF;

  SELECT public.generate_purchase_id() INTO v_purchase_id;
  FOR i IN (v_existing + 1)..v_count LOOP
    INSERT INTO rent_cards (landlord_user_id, status, escrow_transaction_id, serial_number, purchase_id)
    VALUES (v_escrow.user_id, 'awaiting_serial', p_escrow_id, NULL, v_purchase_id);
  END LOOP;

  RETURN jsonb_build_object('success', true, 'created', v_count - v_existing, 'total', v_count);
END;$$;
