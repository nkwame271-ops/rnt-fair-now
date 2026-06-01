
-- Auto-tag + create task for new viewing requests on managed properties
CREATE OR REPLACE FUNCTION public.route_viewing_request_to_platform()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop record;
BEGIN
  SELECT management_enabled, management_assigned_staff_id, management_assigned_office_id
    INTO v_prop FROM public.properties WHERE id = NEW.property_id;

  IF v_prop.management_enabled IS TRUE THEN
    NEW.managed_by_platform := true;
    NEW.assigned_staff_id := v_prop.management_assigned_staff_id;

    INSERT INTO public.management_task_assignments(
      property_id, task_type, source_id, assigned_staff_id, assigned_office_id,
      status, assigned_at, created_by
    ) VALUES (
      NEW.property_id, 'viewing_request', NEW.id,
      v_prop.management_assigned_staff_id,
      v_prop.management_assigned_office_id,
      CASE WHEN v_prop.management_assigned_staff_id IS NOT NULL THEN 'in_progress' ELSE 'open' END,
      CASE WHEN v_prop.management_assigned_staff_id IS NOT NULL THEN now() ELSE NULL END,
      NEW.tenant_user_id
    ) ON CONFLICT (task_type, source_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_viewing_request ON public.viewing_requests;
CREATE TRIGGER trg_route_viewing_request
  BEFORE INSERT ON public.viewing_requests
  FOR EACH ROW EXECUTE FUNCTION public.route_viewing_request_to_platform();

-- Auto-tag + create task for new pending tenants (tenant onboarding) on managed properties
CREATE OR REPLACE FUNCTION public.route_pending_tenant_to_platform()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prop record;
BEGIN
  IF NEW.property_id IS NULL THEN RETURN NEW; END IF;

  SELECT management_enabled, management_assigned_staff_id, management_assigned_office_id
    INTO v_prop FROM public.properties WHERE id = NEW.property_id;

  IF v_prop.management_enabled IS TRUE THEN
    NEW.managed_by_platform := true;
    NEW.assigned_staff_id := v_prop.management_assigned_staff_id;

    INSERT INTO public.management_task_assignments(
      property_id, task_type, source_id, assigned_staff_id, assigned_office_id,
      status, assigned_at
    ) VALUES (
      NEW.property_id, 'tenant_onboarding', NEW.id,
      v_prop.management_assigned_staff_id,
      v_prop.management_assigned_office_id,
      CASE WHEN v_prop.management_assigned_staff_id IS NOT NULL THEN 'in_progress' ELSE 'open' END,
      CASE WHEN v_prop.management_assigned_staff_id IS NOT NULL THEN now() ELSE NULL END
    ) ON CONFLICT (task_type, source_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_route_pending_tenant ON public.pending_tenants;
CREATE TRIGGER trg_route_pending_tenant
  BEFORE INSERT ON public.pending_tenants
  FOR EACH ROW EXECUTE FUNCTION public.route_pending_tenant_to_platform();
