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
           assigned_staff_id   = CASE WHEN NEW.management_enabled
                                      THEN NEW.management_assigned_staff_id
                                      ELSE NULL END
     WHERE property_id = NEW.id
       AND status IN ('pending','awaiting_payment');

    UPDATE public.pending_tenants pt
       SET managed_by_platform = NEW.management_enabled,
           assigned_staff_id   = CASE WHEN NEW.management_enabled
                                      THEN NEW.management_assigned_staff_id
                                      ELSE NULL END
     WHERE pt.tenancy_id IN (
       SELECT t.id
         FROM public.tenancies t
         JOIN public.units u ON u.id = t.unit_id
        WHERE u.property_id = NEW.id
     );
  END IF;
  RETURN NEW;
END;
$$;