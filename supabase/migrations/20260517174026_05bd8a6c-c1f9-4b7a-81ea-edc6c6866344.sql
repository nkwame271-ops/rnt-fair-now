
-- Sequence + ticket generator
CREATE SEQUENCE IF NOT EXISTS public.safety_ticket_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_safety_ticket()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'SR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('public.safety_ticket_seq')::text, 5, '0');
END;
$$;

-- Main reports table
CREATE TABLE IF NOT EXISTS public.safety_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE DEFAULT public.generate_safety_ticket(),
  report_kind text NOT NULL CHECK (report_kind IN ('safety_report','panic_emergency')),
  category text,
  emergency_type text CHECK (emergency_type IS NULL OR emergency_type IN ('police','medical','fire','security','other')),
  user_id uuid NOT NULL,
  user_role text NOT NULL,
  user_name_snapshot text,
  user_phone_snapshot text,
  property_id uuid,
  unit_id uuid,
  hostel_or_hall text,
  school text,
  description text,
  evidence_urls text[] DEFAULT '{}',
  latitude double precision,
  longitude double precision,
  location_accuracy double precision,
  location_address text,
  is_silent boolean NOT NULL DEFAULT false,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','acknowledged','under_review','escalated','resolved','closed','false_alert')),
  assigned_to_user_id uuid,
  assigned_office_id text,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  response_time_seconds integer,
  escalated_to text[] DEFAULT '{}',
  escalated_at timestamptz,
  escalation_notes text,
  user_marked_safe_at timestamptz,
  closure_reason text,
  closed_at timestamptz,
  closed_by uuid,
  false_alert_count_at_time integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_reports_user ON public.safety_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_safety_reports_status ON public.safety_reports(status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_kind_status ON public.safety_reports(report_kind, status);
CREATE INDEX IF NOT EXISTS idx_safety_reports_created ON public.safety_reports(created_at DESC);

CREATE TRIGGER trg_safety_reports_updated
BEFORE UPDATE ON public.safety_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Location pings
CREATE TABLE IF NOT EXISTS public.safety_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.safety_reports(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_pings_report ON public.safety_location_pings(report_id, recorded_at DESC);

-- Audit log
CREATE TABLE IF NOT EXISTS public.safety_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.safety_reports(id) ON DELETE CASCADE,
  actor_user_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_audit_report ON public.safety_audit_log(report_id, created_at DESC);

-- Notes
CREATE TABLE IF NOT EXISTS public.safety_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.safety_reports(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_safety_notes_report ON public.safety_notes(report_id, created_at DESC);

-- Contacts
CREATE TABLE IF NOT EXISTS public.safety_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type text NOT NULL CHECK (contact_type IN ('super_admin','safety_admin','nugs_desk','campus_security','user_emergency_contact','other')),
  name text NOT NULL,
  phone text,
  email text,
  scope text NOT NULL DEFAULT 'global' CHECK (scope IN ('global','region','school','office')),
  scope_value text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_safety_contacts_updated
BEFORE UPDATE ON public.safety_contacts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.safety_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_location_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.safety_contacts ENABLE ROW LEVEL SECURITY;

-- safety_reports policies
CREATE POLICY "Users insert own safety reports"
ON public.safety_reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users view own safety reports"
ON public.safety_reports FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_main_admin(auth.uid()));

CREATE POLICY "Users update own safety reports limited"
ON public.safety_reports FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.is_main_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_main_admin(auth.uid()));

CREATE POLICY "Admins delete safety reports"
ON public.safety_reports FOR DELETE TO authenticated
USING (public.is_main_admin(auth.uid()));

-- pings
CREATE POLICY "Owner or admin view pings"
ON public.safety_location_pings FOR SELECT TO authenticated
USING (
  public.is_main_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);

CREATE POLICY "Owner adds pings"
ON public.safety_location_pings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);

-- audit log
CREATE POLICY "Owner or admin view audit"
ON public.safety_audit_log FOR SELECT TO authenticated
USING (
  public.is_main_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);

CREATE POLICY "Authenticated insert audit"
ON public.safety_audit_log FOR INSERT TO authenticated
WITH CHECK (
  public.is_main_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);

-- notes
CREATE POLICY "Admins manage safety notes"
ON public.safety_notes FOR ALL TO authenticated
USING (public.is_main_admin(auth.uid()))
WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "Owner views safety notes"
ON public.safety_notes FOR SELECT TO authenticated
USING (
  public.is_main_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid())
);

-- contacts
CREATE POLICY "Admins view contacts"
ON public.safety_contacts FOR SELECT TO authenticated
USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Super admins manage contacts"
ON public.safety_contacts FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('safety-evidence', 'safety-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own safety evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'safety-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users view own safety evidence"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'safety-evidence'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.is_main_admin(auth.uid()))
);

CREATE POLICY "Admins delete safety evidence"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'safety-evidence' AND public.is_main_admin(auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.safety_location_pings;
