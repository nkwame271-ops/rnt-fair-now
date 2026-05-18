
-- ============================================================
-- Complaint Management Upgrade — Phase 1 (revised)
-- complaint_notes already exists with complaint_id; we extend it
-- ============================================================

-- 1. Extensions on complaints / landlord_complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complaint_title text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS current_stage text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_officer_user_id uuid,
  ADD COLUMN IF NOT EXISTS hearing_room_id uuid,
  ADD COLUMN IF NOT EXISTS next_hearing_at timestamptz;

ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS complaint_title text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS current_stage text NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS assigned_officer_user_id uuid,
  ADD COLUMN IF NOT EXISTS hearing_room_id uuid,
  ADD COLUMN IF NOT EXISTS next_hearing_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_complaints_current_stage ON public.complaints (current_stage);
CREATE INDEX IF NOT EXISTS idx_complaints_assigned_officer ON public.complaints (assigned_officer_user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_next_hearing ON public.complaints (next_hearing_at);
CREATE INDEX IF NOT EXISTS idx_lcomplaints_current_stage ON public.landlord_complaints (current_stage);
CREATE INDEX IF NOT EXISTS idx_lcomplaints_assigned_officer ON public.landlord_complaints (assigned_officer_user_id);

-- 2. Role helper
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_staff
    WHERE user_id = _user_id
      AND (admin_type = _role OR admin_type IN ('main_admin', 'super_admin'))
  )
$$;

-- 3. Hearing rooms
CREATE TABLE IF NOT EXISTS public.hearing_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text REFERENCES public.offices(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer DEFAULT 10,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hearing_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin staff view hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Admin staff view hearing rooms" ON public.hearing_rooms FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Main admins manage hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Main admins manage hearing rooms" ON public.hearing_rooms FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

-- 4. Status history
CREATE TABLE IF NOT EXISTS public.complaint_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_kind text NOT NULL DEFAULT 'complaint',
  previous_status text,
  new_status text NOT NULL,
  reason text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_csh_case ON public.complaint_status_history (case_id);
DROP POLICY IF EXISTS "Admin read status history" ON public.complaint_status_history;
CREATE POLICY "Admin read status history" ON public.complaint_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin insert status history" ON public.complaint_status_history;
CREATE POLICY "Admin insert status history" ON public.complaint_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- 5. Audit log
CREATE TABLE IF NOT EXISTS public.complaint_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  case_kind text DEFAULT 'complaint',
  actor_id uuid,
  actor_name text,
  actor_role text,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_audit_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cal_case ON public.complaint_audit_log (case_id);
DROP POLICY IF EXISTS "Admin read audit log" ON public.complaint_audit_log;
CREATE POLICY "Admin read audit log" ON public.complaint_audit_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin insert audit log" ON public.complaint_audit_log;
CREATE POLICY "Admin insert audit log" ON public.complaint_audit_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- 6. Versioned documents
CREATE TABLE IF NOT EXISTS public.complaint_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_kind text NOT NULL DEFAULT 'complaint',
  form_type text NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft',
  file_url text,
  change_reason text,
  generated_by uuid,
  edited_by uuid,
  finalized_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  CONSTRAINT uq_case_form_version UNIQUE (case_id, form_type, version_number)
);
ALTER TABLE public.complaint_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cd_case ON public.complaint_documents (case_id);
DROP POLICY IF EXISTS "Admin read complaint documents" ON public.complaint_documents;
CREATE POLICY "Admin read complaint documents" ON public.complaint_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin insert complaint documents" ON public.complaint_documents;
CREATE POLICY "Admin insert complaint documents" ON public.complaint_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin update complaint documents" ON public.complaint_documents;
CREATE POLICY "Admin update complaint documents" ON public.complaint_documents FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- 7. Witnesses
CREATE TABLE IF NOT EXISTS public.complaint_witnesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_kind text NOT NULL DEFAULT 'complaint',
  side text NOT NULL CHECK (side IN ('complainant','respondent')),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  expected_testimony text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_witnesses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cw_case ON public.complaint_witnesses (case_id);
DROP POLICY IF EXISTS "Admin manage witnesses" ON public.complaint_witnesses;
CREATE POLICY "Admin manage witnesses" ON public.complaint_witnesses FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- 8. Extend existing complaint_notes (keeps complaint_id column)
ALTER TABLE public.complaint_notes
  ADD COLUMN IF NOT EXISTS case_kind text NOT NULL DEFAULT 'complaint',
  ADD COLUMN IF NOT EXISTS note_type text NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS edit_history jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
DO $$ BEGIN
  ALTER TABLE public.complaint_notes ADD CONSTRAINT complaint_notes_note_type_check
    CHECK (note_type IN ('internal','official_proceedings'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9. Hearings
CREATE TABLE IF NOT EXISTS public.complaint_hearings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_kind text NOT NULL DEFAULT 'complaint',
  scheduled_at timestamptz NOT NULL,
  room_id uuid REFERENCES public.hearing_rooms(id) ON DELETE SET NULL,
  officer_user_id uuid,
  priority text DEFAULT 'normal',
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','ongoing','completed','adjourned','cancelled')),
  attendance jsonb DEFAULT '{}'::jsonb,
  outcome text,
  notes text,
  reschedule_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_hearings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ch_case ON public.complaint_hearings (case_id);
CREATE INDEX IF NOT EXISTS idx_ch_scheduled ON public.complaint_hearings (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_ch_officer ON public.complaint_hearings (officer_user_id);
DROP POLICY IF EXISTS "Admin read hearings" ON public.complaint_hearings;
CREATE POLICY "Admin read hearings" ON public.complaint_hearings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admin manage hearings" ON public.complaint_hearings;
CREATE POLICY "Admin manage hearings" ON public.complaint_hearings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- 10. Decisions
CREATE TABLE IF NOT EXISTS public.complaint_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_kind text NOT NULL DEFAULT 'complaint',
  outcome text NOT NULL,
  decision_summary text,
  orders text,
  payment_orders jsonb,
  compliance_deadline date,
  next_hearing_at timestamptz,
  document_id uuid REFERENCES public.complaint_documents(id) ON DELETE SET NULL,
  officer_user_id uuid NOT NULL,
  internal_remarks text,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_decisions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cdec_case ON public.complaint_decisions (case_id);
DROP POLICY IF EXISTS "Admin read decisions" ON public.complaint_decisions;
CREATE POLICY "Admin read decisions" ON public.complaint_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Adjudicators record decisions" ON public.complaint_decisions;
CREATE POLICY "Adjudicators record decisions" ON public.complaint_decisions FOR INSERT TO authenticated
  WITH CHECK (public.has_admin_role(auth.uid(), 'adjudicating_officer') OR public.is_main_admin(auth.uid()));

-- 11. updated_at triggers
DROP TRIGGER IF EXISTS trg_hearings_updated_at ON public.complaint_hearings;
CREATE TRIGGER trg_hearings_updated_at BEFORE UPDATE ON public.complaint_hearings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_rooms_updated_at ON public.hearing_rooms;
CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON public.hearing_rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_notes_updated_at ON public.complaint_notes;
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.complaint_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Stage change logging
CREATE OR REPLACE FUNCTION public.log_complaint_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.current_stage IS DISTINCT FROM OLD.current_stage THEN
    INSERT INTO public.complaint_status_history (case_id, case_kind, previous_status, new_status, changed_by)
    VALUES (NEW.id, TG_ARGV[0], OLD.current_stage, NEW.current_stage, auth.uid());
  END IF;
  NEW.last_activity_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_complaints_stage_log ON public.complaints;
CREATE TRIGGER trg_complaints_stage_log BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.log_complaint_stage_change('complaint');
DROP TRIGGER IF EXISTS trg_lcomplaints_stage_log ON public.landlord_complaints;
CREATE TRIGGER trg_lcomplaints_stage_log BEFORE UPDATE ON public.landlord_complaints
  FOR EACH ROW EXECUTE FUNCTION public.log_complaint_stage_change('landlord_complaint');
