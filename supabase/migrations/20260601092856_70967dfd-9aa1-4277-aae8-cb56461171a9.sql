
-- =====================================================================
-- Landlord Management Support — schema foundation
-- =====================================================================

-- 1. Extend properties with management flags
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS management_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS management_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS management_assigned_staff_id uuid,
  ADD COLUMN IF NOT EXISTS management_assigned_office_id text,
  ADD COLUMN IF NOT EXISTS management_notes text;

CREATE INDEX IF NOT EXISTS idx_properties_management_enabled
  ON public.properties (management_enabled) WHERE management_enabled = true;
CREATE INDEX IF NOT EXISTS idx_properties_management_staff
  ON public.properties (management_assigned_staff_id) WHERE management_assigned_staff_id IS NOT NULL;

-- 2. Audit log
CREATE TABLE IF NOT EXISTS public.property_management_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.property_management_log TO authenticated;
GRANT ALL ON public.property_management_log TO service_role;

ALTER TABLE public.property_management_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords read own management log"
  ON public.property_management_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_management_log.property_id
      AND p.landlord_user_id = auth.uid()
  ));

CREATE POLICY "Admins read all management log"
  ON public.property_management_log FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid())
         OR EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

CREATE POLICY "Landlords & admins insert management log"
  ON public.property_management_log FOR INSERT TO authenticated
  WITH CHECK (
    actor_id = auth.uid()
    AND (
      EXISTS (SELECT 1 FROM public.properties p
              WHERE p.id = property_management_log.property_id
                AND p.landlord_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid())
    )
  );

-- 3. Generic task assignments
CREATE TABLE IF NOT EXISTS public.management_task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN (
    'viewing_request','tenant_onboarding','inquiry','compliance','rent_followup'
  )),
  source_id uuid,
  assigned_staff_id uuid,
  assigned_office_id text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','done','reassigned','cancelled')),
  assigned_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_mta_property ON public.management_task_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_mta_assignee ON public.management_task_assignments(assigned_staff_id);
CREATE INDEX IF NOT EXISTS idx_mta_status_type ON public.management_task_assignments(status, task_type);

GRANT SELECT, INSERT, UPDATE ON public.management_task_assignments TO authenticated;
GRANT ALL ON public.management_task_assignments TO service_role;

ALTER TABLE public.management_task_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords read own property tasks"
  ON public.management_task_assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = management_task_assignments.property_id
      AND p.landlord_user_id = auth.uid()
  ));

CREATE POLICY "Admin staff read management tasks"
  ON public.management_task_assignments FOR SELECT TO authenticated
  USING (
    public.is_main_admin(auth.uid())
    OR assigned_staff_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Main admins manage tasks"
  ON public.management_task_assignments FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "Assigned staff update own tasks"
  ON public.management_task_assignments FOR UPDATE TO authenticated
  USING (assigned_staff_id = auth.uid())
  WITH CHECK (assigned_staff_id = auth.uid());

CREATE TRIGGER mta_updated_at
  BEFORE UPDATE ON public.management_task_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Tag downstream tables with derived flag + assignee for fast filtering
ALTER TABLE public.viewing_requests
  ADD COLUMN IF NOT EXISTS managed_by_platform boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid;
CREATE INDEX IF NOT EXISTS idx_vr_managed ON public.viewing_requests(managed_by_platform) WHERE managed_by_platform = true;
CREATE INDEX IF NOT EXISTS idx_vr_assignee ON public.viewing_requests(assigned_staff_id) WHERE assigned_staff_id IS NOT NULL;

ALTER TABLE public.pending_tenants
  ADD COLUMN IF NOT EXISTS managed_by_platform boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_staff_id uuid;
CREATE INDEX IF NOT EXISTS idx_pt_managed ON public.pending_tenants(managed_by_platform) WHERE managed_by_platform = true;

-- 5. Trigger: when management toggled on properties, propagate to open viewing requests
CREATE OR REPLACE FUNCTION public.propagate_property_management_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.management_enabled IS DISTINCT FROM OLD.management_enabled
     OR NEW.management_assigned_staff_id IS DISTINCT FROM OLD.management_assigned_staff_id THEN
    UPDATE public.viewing_requests
      SET managed_by_platform = NEW.management_enabled,
          assigned_staff_id = CASE WHEN NEW.management_enabled
                                   THEN NEW.management_assigned_staff_id
                                   ELSE NULL END
      WHERE property_id = NEW.id AND status IN ('pending','awaiting_payment');

    UPDATE public.pending_tenants
      SET managed_by_platform = NEW.management_enabled,
          assigned_staff_id = CASE WHEN NEW.management_enabled
                                   THEN NEW.management_assigned_staff_id
                                   ELSE NULL END
      WHERE property_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_propagate_mgmt_flag ON public.properties;
CREATE TRIGGER trg_propagate_mgmt_flag
  AFTER UPDATE OF management_enabled, management_assigned_staff_id ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.propagate_property_management_flag();

-- 6. RPC: toggle management with audit
CREATE OR REPLACE FUNCTION public.set_property_management(
  p_property_id uuid,
  p_enabled boolean,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop record;
BEGIN
  SELECT * INTO v_prop FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF v_prop IS NULL THEN RAISE EXCEPTION 'Property not found'; END IF;

  IF v_prop.landlord_user_id <> auth.uid()
     AND NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.properties
    SET management_enabled = p_enabled,
        management_enabled_at = CASE WHEN p_enabled THEN COALESCE(management_enabled_at, now()) ELSE NULL END,
        management_notes = COALESCE(p_notes, management_notes),
        management_assigned_staff_id = CASE WHEN p_enabled THEN management_assigned_staff_id ELSE NULL END,
        management_assigned_office_id = CASE WHEN p_enabled THEN management_assigned_office_id ELSE NULL END
    WHERE id = p_property_id;

  INSERT INTO public.property_management_log(property_id, action, actor_id, payload)
    VALUES (p_property_id,
            CASE WHEN p_enabled THEN 'enabled' ELSE 'disabled' END,
            auth.uid(),
            jsonb_build_object('notes', p_notes));

  RETURN jsonb_build_object('success', true, 'enabled', p_enabled);
END;
$$;

-- 7. RPC: assign property to staff (admin only)
CREATE OR REPLACE FUNCTION public.assign_property_to_staff(
  p_property_id uuid,
  p_staff_user_id uuid,
  p_office_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff record;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can assign managed properties';
  END IF;

  IF p_staff_user_id IS NOT NULL THEN
    SELECT * INTO v_staff FROM public.admin_staff WHERE user_id = p_staff_user_id;
    IF v_staff IS NULL THEN RAISE EXCEPTION 'Staff member not found'; END IF;
  END IF;

  UPDATE public.properties
    SET management_assigned_staff_id = p_staff_user_id,
        management_assigned_office_id = COALESCE(p_office_id, v_staff.office_id, management_assigned_office_id)
    WHERE id = p_property_id;

  INSERT INTO public.property_management_log(property_id, action, actor_id, payload)
    VALUES (p_property_id, 'assigned', auth.uid(),
            jsonb_build_object('staff_user_id', p_staff_user_id, 'office_id', p_office_id));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 8. Seed payment_permissions keys (no-op for existing rows, used by frontend gating)
-- (no schema change required; permissions stored in jsonb)
