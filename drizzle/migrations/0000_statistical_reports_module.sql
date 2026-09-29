CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE public.report_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('view','export','consolidate','manage','configure')),
  granted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);
GRANT SELECT, INSERT, DELETE ON public.report_permissions TO authenticated;
GRANT ALL ON public.report_permissions TO service_role;
ALTER TABLE public.report_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_report_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR EXISTS (
    SELECT 1 FROM public.report_permissions WHERE user_id = _user_id AND permission = _perm)
$$;

CREATE POLICY "Super admin manages report permissions" ON public.report_permissions FOR ALL TO authenticated
  USING ((SELECT public.is_super_admin(auth.uid()))) WITH CHECK ((SELECT public.is_super_admin(auth.uid())));
CREATE POLICY "Users see own report permissions" ON public.report_permissions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.reporting_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  periods text[] NOT NULL DEFAULT ARRAY['Q1','Q2','Q3','Q4','Annual'],
  open_years int[] NOT NULL DEFAULT ARRAY[2025,2026],
  submissions_open boolean NOT NULL DEFAULT true,
  require_pin boolean NOT NULL DEFAULT true,
  accept_late boolean NOT NULL DEFAULT true,
  deadlines jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
INSERT INTO public.reporting_config (id) VALUES (1);
GRANT SELECT ON public.reporting_config TO anon, authenticated;
GRANT UPDATE ON public.reporting_config TO authenticated;
GRANT ALL ON public.reporting_config TO service_role;
ALTER TABLE public.reporting_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads reporting config" ON public.reporting_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Configurers update reporting config" ON public.reporting_config FOR UPDATE TO authenticated
  USING ((SELECT public.has_report_permission(auth.uid(),'configure'))) WITH CHECK ((SELECT public.has_report_permission(auth.uid(),'configure')));

CREATE TABLE public.office_report_pins (
  office_id text PRIMARY KEY,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT ALL ON public.office_report_pins TO service_role;
ALTER TABLE public.office_report_pins ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.statistical_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_code text NOT NULL UNIQUE,
  office_id text NOT NULL,
  office_name text,
  region text,
  reporting_period text NOT NULL,
  reporting_year int NOT NULL,
  submitter_name text NOT NULL,
  submitter_position text NOT NULL,
  revision_no int NOT NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'validated' CHECK (status IN ('validated','reopened','superseded')),
  is_late boolean NOT NULL DEFAULT false,
  ip_hash text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX statistical_reports_one_current ON public.statistical_reports (office_id, reporting_period, reporting_year) WHERE is_current;
CREATE INDEX statistical_reports_submitted_idx ON public.statistical_reports (submitted_at DESC);

CREATE TABLE public.report_case_statistics (
  report_id uuid PRIMARY KEY REFERENCES public.statistical_reports(id) ON DELETE CASCADE,
  total_cases int NOT NULL CHECK (total_cases >= 0),
  digital int NOT NULL CHECK (digital >= 0),
  manual int NOT NULL CHECK (manual >= 0),
  tenant_male int NOT NULL CHECK (tenant_male >= 0),
  tenant_female int NOT NULL CHECK (tenant_female >= 0),
  landlord_male int NOT NULL CHECK (landlord_male >= 0),
  landlord_female int NOT NULL CHECK (landlord_female >= 0),
  settled int NOT NULL CHECK (settled >= 0),
  struck_off int NOT NULL CHECK (struck_off >= 0),
  withdrawn int NOT NULL CHECK (withdrawn >= 0),
  referred_court int NOT NULL CHECK (referred_court >= 0),
  pending int NOT NULL CHECK (pending >= 0),
  arrears int NOT NULL DEFAULT 0 CHECK (arrears >= 0),
  absconded int NOT NULL DEFAULT 0 CHECK (absconded >= 0),
  other_matters int NOT NULL DEFAULT 0 CHECK (other_matters >= 0),
  ag_landlords int NOT NULL CHECK (ag_landlords >= 0),
  ag_tenants int NOT NULL CHECK (ag_tenants >= 0),
  sittings_to_settle numeric NOT NULL DEFAULT 0 CHECK (sittings_to_settle >= 0),
  CONSTRAINT rcs_channel_sum CHECK (digital + manual = total_cases),
  CONSTRAINT rcs_gender_sum CHECK (tenant_male + tenant_female + landlord_male + landlord_female = total_cases),
  CONSTRAINT rcs_outcome_sum CHECK (settled + struck_off + withdrawn + referred_court + pending = total_cases),
  CONSTRAINT rcs_ag_sum CHECK (ag_landlords + ag_tenants = referred_court)
);

CREATE TABLE public.report_recovery_statistics (
  report_id uuid PRIMARY KEY REFERENCES public.statistical_reports(id) ON DELETE CASCADE,
  recovered_landlords numeric(14,2) NOT NULL CHECK (recovered_landlords >= 0),
  recovered_tenants numeric(14,2) NOT NULL CHECK (recovered_tenants >= 0),
  total_recovered numeric(14,2) GENERATED ALWAYS AS (recovered_landlords + recovered_tenants) STORED
);

CREATE TABLE public.report_registration_statistics (
  report_id uuid PRIMARY KEY REFERENCES public.statistical_reports(id) ON DELETE CASCADE,
  inspections int NOT NULL DEFAULT 0 CHECK (inspections >= 0),
  agreements_registered int NOT NULL DEFAULT 0 CHECK (agreements_registered >= 0),
  rent_cards_issued int NOT NULL DEFAULT 0 CHECK (rent_cards_issued >= 0),
  landlords_registered int NOT NULL DEFAULT 0 CHECK (landlords_registered >= 0),
  tenants_registered int NOT NULL DEFAULT 0 CHECK (tenants_registered >= 0),
  radio_engagements int NOT NULL DEFAULT 0 CHECK (radio_engagements >= 0),
  tv_engagements int NOT NULL DEFAULT 0 CHECK (tv_engagements >= 0)
);

CREATE TABLE public.report_awareness_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.statistical_reports(id) ON DELETE CASCADE,
  medium text NOT NULL CHECK (medium IN ('radio','tv')),
  station_name text NOT NULL CHECK (length(station_name) BETWEEN 1 AND 120)
);
CREATE INDEX report_awareness_report_idx ON public.report_awareness_activity(report_id);

CREATE TABLE public.report_submission_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.statistical_reports(id),
  office_id text NOT NULL,
  reporting_period text NOT NULL,
  reporting_year int NOT NULL,
  revision_no int NOT NULL,
  snapshot jsonb NOT NULL,
  submitted_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.report_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid,
  action text NOT NULL,
  actor_user_id uuid,
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['statistical_reports','report_case_statistics','report_recovery_statistics','report_registration_statistics','report_awareness_activity','report_submission_revisions','report_audit_log'] LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Report viewers read" ON public.%I FOR SELECT TO authenticated USING ((SELECT public.has_report_permission(auth.uid(),''view'')))', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.report_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Audit records are immutable'; END $$;
CREATE TRIGGER report_audit_no_change BEFORE UPDATE OR DELETE ON public.report_audit_log FOR EACH ROW EXECUTE FUNCTION public.report_audit_immutable();
CREATE TRIGGER report_revisions_no_change BEFORE UPDATE OR DELETE ON public.report_submission_revisions FOR EACH ROW EXECUTE FUNCTION public.report_audit_immutable();

-- Submission (called only by the edge function via service role)
CREATE OR REPLACE FUNCTION public.submit_statistical_report(p jsonb, p_ip_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  cfg public.reporting_config;
  v_office public.offices;
  v_pin text;
  v_existing public.statistical_reports;
  v_rev int := 1;
  v_id uuid;
  v_code text;
  v_late boolean := false;
  v_deadline text;
  c jsonb := p->'cases'; r jsonb := p->'recovery'; g jsonb := p->'registration';
  s text;
BEGIN
  SELECT * INTO cfg FROM public.reporting_config WHERE id = 1;
  IF NOT cfg.submissions_open THEN RAISE EXCEPTION 'Report submission is currently closed'; END IF;
  IF NOT (p->>'reporting_period' = ANY(cfg.periods)) THEN RAISE EXCEPTION 'Invalid reporting period'; END IF;
  IF NOT ((p->>'reporting_year')::int = ANY(cfg.open_years)) THEN RAISE EXCEPTION 'Reporting year is not open'; END IF;

  SELECT * INTO v_office FROM public.offices WHERE id = p->>'office_id';
  IF v_office.id IS NULL THEN RAISE EXCEPTION 'Unknown office'; END IF;

  IF p_ip_hash IS NOT NULL AND (SELECT count(*) FROM public.statistical_reports WHERE ip_hash = p_ip_hash AND submitted_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Too many submissions. Please try again later.';
  END IF;
  IF (SELECT count(*) FROM public.statistical_reports WHERE office_id = v_office.id AND submitted_at > now() - interval '10 minutes') >= 3 THEN
    RAISE EXCEPTION 'Too many submissions for this office. Please wait a few minutes.';
  END IF;

  IF cfg.require_pin THEN
    SELECT pin_hash INTO v_pin FROM public.office_report_pins WHERE office_id = v_office.id;
    IF v_pin IS NULL THEN RAISE EXCEPTION 'No submission PIN has been set for this office. Contact the administrator.'; END IF;
    IF crypt(coalesce(p->>'pin',''), v_pin) <> v_pin THEN
      INSERT INTO public.report_audit_log(action, actor_name, details) VALUES ('pin_failed', p->>'submitter_name', jsonb_build_object('office_id', v_office.id, 'ip', p_ip_hash));
      RAISE EXCEPTION 'Incorrect office PIN';
    END IF;
  END IF;

  v_deadline := cfg.deadlines->>(p->>'reporting_year' || '-' || (p->>'reporting_period'));
  IF v_deadline IS NOT NULL AND now()::date > v_deadline::date THEN
    IF NOT cfg.accept_late THEN RAISE EXCEPTION 'The submission deadline for this period has passed'; END IF;
    v_late := true;
  END IF;

  SELECT * INTO v_existing FROM public.statistical_reports
   WHERE office_id = v_office.id AND reporting_period = p->>'reporting_period' AND reporting_year = (p->>'reporting_year')::int AND is_current
   FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    IF coalesce((p->>'confirm_revision')::boolean, false) = false THEN
      RETURN jsonb_build_object('needs_revision_confirm', true, 'existing_code', v_existing.report_code, 'existing_submitted_at', v_existing.submitted_at);
    END IF;
    v_rev := v_existing.revision_no + 1;
    UPDATE public.statistical_reports SET is_current = false, status = 'superseded' WHERE id = v_existing.id;
  END IF;

  v_code := 'RPT-' || (p->>'reporting_year') || '-' || upper(p->>'reporting_period') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));

  INSERT INTO public.statistical_reports(report_code, office_id, office_name, region, reporting_period, reporting_year, submitter_name, submitter_position, revision_no, is_late, ip_hash)
  VALUES (v_code, v_office.id, v_office.name, v_office.region, p->>'reporting_period', (p->>'reporting_year')::int,
          left(trim(p->>'submitter_name'),120), left(trim(p->>'submitter_position'),120), v_rev, v_late, p_ip_hash)
  RETURNING id INTO v_id;

  INSERT INTO public.report_case_statistics VALUES (v_id,
    (c->>'total_cases')::int, (c->>'digital')::int, (c->>'manual')::int,
    (c->>'tenant_male')::int, (c->>'tenant_female')::int, (c->>'landlord_male')::int, (c->>'landlord_female')::int,
    (c->>'settled')::int, (c->>'struck_off')::int, (c->>'withdrawn')::int, (c->>'referred_court')::int, (c->>'pending')::int,
    coalesce((c->>'arrears')::int,0), coalesce((c->>'absconded')::int,0), coalesce((c->>'other_matters')::int,0),
    (c->>'ag_landlords')::int, (c->>'ag_tenants')::int, coalesce((c->>'sittings_to_settle')::numeric,0));

  INSERT INTO public.report_recovery_statistics(report_id, recovered_landlords, recovered_tenants)
  VALUES (v_id, (r->>'recovered_landlords')::numeric, (r->>'recovered_tenants')::numeric);

  INSERT INTO public.report_registration_statistics VALUES (v_id,
    coalesce((g->>'inspections')::int,0), coalesce((g->>'agreements_registered')::int,0), coalesce((g->>'rent_cards_issued')::int,0),
    coalesce((g->>'landlords_registered')::int,0), coalesce((g->>'tenants_registered')::int,0),
    coalesce((g->>'radio_engagements')::int,0), coalesce((g->>'tv_engagements')::int,0));

  FOR s IN SELECT jsonb_array_elements_text(coalesce(p->'radio_stations','[]'::jsonb)) LOOP
    IF length(trim(s)) > 0 THEN INSERT INTO public.report_awareness_activity(report_id, medium, station_name) VALUES (v_id,'radio',left(trim(s),120)); END IF;
  END LOOP;
  FOR s IN SELECT jsonb_array_elements_text(coalesce(p->'tv_stations','[]'::jsonb)) LOOP
    IF length(trim(s)) > 0 THEN INSERT INTO public.report_awareness_activity(report_id, medium, station_name) VALUES (v_id,'tv',left(trim(s),120)); END IF;
  END LOOP;

  INSERT INTO public.report_submission_revisions(report_id, office_id, reporting_period, reporting_year, revision_no, snapshot, submitted_by_name)
  VALUES (v_id, v_office.id, p->>'reporting_period', (p->>'reporting_year')::int, v_rev, p - 'pin', p->>'submitter_name');
  INSERT INTO public.report_audit_log(report_id, action, actor_name, details)
  VALUES (v_id, CASE WHEN v_rev > 1 THEN 'revision_submitted' ELSE 'submitted' END, p->>'submitter_name', jsonb_build_object('revision', v_rev, 'late', v_late));

  RETURN jsonb_build_object('report_code', v_code, 'revision_no', v_rev, 'submitted_at', now(), 'is_late', v_late);
END $$;
REVOKE ALL ON FUNCTION public.submit_statistical_report(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_statistical_report(jsonb, text) TO service_role;

CREATE OR REPLACE FUNCTION public.set_office_report_pin(p_office_id text, p_pin text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.has_report_permission(auth.uid(),'configure') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF p_pin !~ '^[0-9]{4,8}$' THEN RAISE EXCEPTION 'PIN must be 4 to 8 digits'; END IF;
  INSERT INTO public.office_report_pins(office_id, pin_hash, updated_by) VALUES (p_office_id, crypt(p_pin, gen_salt('bf')), auth.uid())
  ON CONFLICT (office_id) DO UPDATE SET pin_hash = excluded.pin_hash, updated_at = now(), updated_by = auth.uid();
  INSERT INTO public.report_audit_log(action, actor_user_id, details) VALUES ('pin_set', auth.uid(), jsonb_build_object('office_id', p_office_id));
END $$;
GRANT EXECUTE ON FUNCTION public.set_office_report_pin(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_office_report_pin_status()
RETURNS TABLE(office_id text, has_pin boolean, updated_at timestamptz) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id, p.office_id IS NOT NULL, p.updated_at FROM public.offices o LEFT JOIN public.office_report_pins p ON p.office_id = o.id
  WHERE public.has_report_permission(auth.uid(),'configure')
$$;
GRANT EXECUTE ON FUNCTION public.list_office_report_pin_status() TO authenticated;

CREATE OR REPLACE FUNCTION public.reopen_statistical_report(p_report_id uuid, p_reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_report_permission(auth.uid(),'manage') THEN RAISE EXCEPTION 'Not allowed'; END IF;
  UPDATE public.statistical_reports SET status = 'reopened' WHERE id = p_report_id AND is_current;
  INSERT INTO public.report_audit_log(report_id, action, actor_user_id, details) VALUES (p_report_id, 'reopened', auth.uid(), jsonb_build_object('reason', p_reason));
END $$;
GRANT EXECUTE ON FUNCTION public.reopen_statistical_report(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.consolidate_statistical_reports(p_from timestamptz, p_to timestamptz, p_region text, p_office text, p_period text, p_year int)
RETURNS TABLE(office_id text, office_name text, region text, reports bigint,
  total_cases bigint, digital bigint, manual bigint, tenant_male bigint, tenant_female bigint, landlord_male bigint, landlord_female bigint,
  settled bigint, struck_off bigint, withdrawn bigint, referred_court bigint, pending bigint, arrears bigint, absconded bigint, other_matters bigint,
  ag_landlords bigint, ag_tenants bigint, avg_sittings numeric,
  recovered_landlords numeric, recovered_tenants numeric, total_recovered numeric,
  inspections bigint, agreements_registered bigint, rent_cards_issued bigint, landlords_registered bigint, tenants_registered bigint,
  radio_engagements bigint, tv_engagements bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.office_id, max(s.office_name), max(s.region), count(*),
    sum(c.total_cases), sum(c.digital), sum(c.manual), sum(c.tenant_male), sum(c.tenant_female), sum(c.landlord_male), sum(c.landlord_female),
    sum(c.settled), sum(c.struck_off), sum(c.withdrawn), sum(c.referred_court), sum(c.pending), sum(c.arrears), sum(c.absconded), sum(c.other_matters),
    sum(c.ag_landlords), sum(c.ag_tenants), round(avg(c.sittings_to_settle),2),
    sum(r.recovered_landlords), sum(r.recovered_tenants), sum(r.total_recovered),
    sum(g.inspections), sum(g.agreements_registered), sum(g.rent_cards_issued), sum(g.landlords_registered), sum(g.tenants_registered),
    sum(g.radio_engagements), sum(g.tv_engagements)
  FROM public.statistical_reports s
  JOIN public.report_case_statistics c ON c.report_id = s.id
  JOIN public.report_recovery_statistics r ON r.report_id = s.id
  JOIN public.report_registration_statistics g ON g.report_id = s.id
  WHERE s.is_current
    AND public.has_report_permission(auth.uid(),'consolidate')
    AND (p_from IS NULL OR s.submitted_at >= p_from)
    AND (p_to IS NULL OR s.submitted_at < p_to)
    AND (p_region IS NULL OR s.region = p_region)
    AND (p_office IS NULL OR s.office_id = p_office)
    AND (p_period IS NULL OR s.reporting_period = p_period)
    AND (p_year IS NULL OR s.reporting_year = p_year)
  GROUP BY s.office_id
  ORDER BY max(s.region), max(s.office_name)
$$;
GRANT EXECUTE ON FUNCTION public.consolidate_statistical_reports(timestamptz, timestamptz, text, text, text, int) TO authenticated;