
CREATE TABLE IF NOT EXISTS public.feature_flag_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('role','user','dashboard','admin_category','institution')),
  target_value text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feature_key, target_type, target_value)
);
CREATE INDEX IF NOT EXISTS idx_ffo_feature ON public.feature_flag_overrides(feature_key);
CREATE INDEX IF NOT EXISTS idx_ffo_target ON public.feature_flag_overrides(target_type, target_value);

CREATE TABLE IF NOT EXISTS public.staff_feature_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid NOT NULL,
  feature_key text NOT NULL,
  sub_key text,
  is_enabled boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_user_id, feature_key, sub_key)
);
CREATE INDEX IF NOT EXISTS idx_sfo_staff ON public.staff_feature_overrides(staff_user_id);
CREATE INDEX IF NOT EXISTS idx_sfo_feature ON public.staff_feature_overrides(feature_key);

ALTER TABLE public.feature_flag_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_feature_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admin full access ffo" ON public.feature_flag_overrides;
DROP POLICY IF EXISTS "Read overrides that target me" ON public.feature_flag_overrides;
DROP POLICY IF EXISTS "Super admin full access sfo" ON public.staff_feature_overrides;
DROP POLICY IF EXISTS "Read my staff mutes" ON public.staff_feature_overrides;

CREATE POLICY "Super admin full access ffo" ON public.feature_flag_overrides FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Read overrides that target me" ON public.feature_flag_overrides FOR SELECT TO authenticated
  USING (
    public.is_main_admin(auth.uid())
    OR (target_type = 'user' AND target_value = auth.uid()::text)
    OR target_type IN ('role','dashboard','admin_category','institution')
  );
CREATE POLICY "Super admin full access sfo" ON public.staff_feature_overrides FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "Read my staff mutes" ON public.staff_feature_overrides FOR SELECT TO authenticated
  USING (staff_user_id = auth.uid() OR public.is_main_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_ffo_updated ON public.feature_flag_overrides;
DROP TRIGGER IF EXISTS trg_sfo_updated ON public.staff_feature_overrides;
CREATE TRIGGER trg_ffo_updated BEFORE UPDATE ON public.feature_flag_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_sfo_updated BEFORE UPDATE ON public.staff_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.resolve_feature_access(
  _user_id uuid,
  _feature_key text,
  _sub_key text DEFAULT NULL,
  _role text DEFAULT NULL,
  _dashboard text DEFAULT NULL,
  _institution text DEFAULT NULL,
  _admin_category text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_default boolean;
  v_override boolean;
BEGIN
  IF _user_id IS NOT NULL THEN
    SELECT is_enabled INTO v_override FROM staff_feature_overrides
    WHERE staff_user_id = _user_id AND feature_key = _feature_key
      AND sub_key IS NOT DISTINCT FROM _sub_key LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;

    SELECT is_enabled INTO v_override FROM feature_flag_overrides
    WHERE feature_key = _feature_key AND target_type = 'user' AND target_value = _user_id::text LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  END IF;

  IF _dashboard IS NOT NULL THEN
    SELECT is_enabled INTO v_override FROM feature_flag_overrides
    WHERE feature_key = _feature_key AND target_type = 'dashboard' AND target_value = _dashboard LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  END IF;
  IF _institution IS NOT NULL THEN
    SELECT is_enabled INTO v_override FROM feature_flag_overrides
    WHERE feature_key = _feature_key AND target_type = 'institution' AND target_value = _institution LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  END IF;
  IF _admin_category IS NOT NULL THEN
    SELECT is_enabled INTO v_override FROM feature_flag_overrides
    WHERE feature_key = _feature_key AND target_type = 'admin_category' AND target_value = _admin_category LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  END IF;
  IF _role IS NOT NULL THEN
    SELECT is_enabled INTO v_override FROM feature_flag_overrides
    WHERE feature_key = _feature_key AND target_type = 'role' AND target_value = _role LIMIT 1;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
  END IF;

  SELECT is_enabled INTO v_default FROM feature_flags WHERE feature_key = _feature_key;
  RETURN COALESCE(v_default, false);
END;
$$;

ALTER TABLE public.safety_reports
  ADD COLUMN IF NOT EXISTS action_taken text CHECK (action_taken IS NULL OR action_taken IN ('call','alert','call_and_alert')),
  ADD COLUMN IF NOT EXISTS live_tracking_enabled boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tracking_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS linked_property_id uuid,
  ADD COLUMN IF NOT EXISTS linked_tenancy_id uuid,
  ADD COLUMN IF NOT EXISTS linked_complaint_id uuid,
  ADD COLUMN IF NOT EXISTS linked_student_id uuid,
  ADD COLUMN IF NOT EXISTS user_note text;

DO $$
BEGIN
  ALTER TABLE public.safety_reports DROP CONSTRAINT IF EXISTS safety_reports_emergency_type_check;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.safety_reports
  ADD CONSTRAINT safety_reports_emergency_type_check
  CHECK (emergency_type IS NULL OR emergency_type IN ('police','medical','fire','health','security','other','general'));

-- safety_location_pings exists with recorded_at; just add user_id and RLS
ALTER TABLE public.safety_location_pings
  ADD COLUMN IF NOT EXISTS user_id uuid;

CREATE INDEX IF NOT EXISTS idx_slp_report ON public.safety_location_pings(report_id, recorded_at);

ALTER TABLE public.safety_location_pings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owner can insert pings" ON public.safety_location_pings;
DROP POLICY IF EXISTS "Owner and admin can read pings" ON public.safety_location_pings;
CREATE POLICY "Owner can insert pings" ON public.safety_location_pings FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR EXISTS (SELECT 1 FROM safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
CREATE POLICY "Owner and admin can read pings" ON public.safety_location_pings FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_main_admin(auth.uid())
         OR EXISTS (SELECT 1 FROM safety_reports r WHERE r.id = report_id AND r.user_id = auth.uid()));
