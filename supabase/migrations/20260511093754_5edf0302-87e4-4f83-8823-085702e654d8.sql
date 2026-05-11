
-- 1. NUGS Rent Cards feature flag
INSERT INTO public.feature_flags (feature_key, label, description, category, is_enabled)
VALUES ('nugs_admin_rent_cards', 'NUGS Rent Cards', 'Show the Rent Cards management page in NUGS sub-admin portal', 'nugs', false)
ON CONFLICT (feature_key) DO NOTHING;

-- 2. Trigger to clear placeholder tenant fields once tenant accepts
CREATE OR REPLACE FUNCTION public.clear_placeholder_on_tenant_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tenant_accepted IS TRUE
     AND NEW.tenant_user_id IS NOT NULL
     AND (OLD.tenant_accepted IS DISTINCT FROM NEW.tenant_accepted
          OR OLD.tenant_user_id IS DISTINCT FROM NEW.tenant_user_id) THEN
    NEW.placeholder_tenant_name := NULL;
    NEW.placeholder_tenant_phone := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_placeholder_on_tenant_accept ON public.tenancies;
CREATE TRIGGER trg_clear_placeholder_on_tenant_accept
BEFORE UPDATE ON public.tenancies
FOR EACH ROW
EXECUTE FUNCTION public.clear_placeholder_on_tenant_accept();

-- 3. Trigger to prevent manual rent changes when locked
CREATE OR REPLACE FUNCTION public.prevent_unit_rent_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Service role bypass (regulator approval flow)
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.rent_locked_at IS NOT NULL
     AND NEW.monthly_rent IS DISTINCT FROM OLD.monthly_rent
     AND (OLD.rent_locked_amount IS NULL OR NEW.monthly_rent IS DISTINCT FROM OLD.rent_locked_amount) THEN
    RAISE EXCEPTION 'Rent for this unit is locked by an approved Rent Increase. Submit a new Rent Increase Application to change it.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_unit_rent_unlock ON public.units;
CREATE TRIGGER trg_prevent_unit_rent_unlock
BEFORE UPDATE ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.prevent_unit_rent_unlock();

CREATE OR REPLACE FUNCTION public.prevent_property_rent_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.rent_locked_at IS NOT NULL
     AND NEW.approved_rent IS DISTINCT FROM OLD.approved_rent
     AND (OLD.rent_locked_amount IS NULL OR NEW.approved_rent IS DISTINCT FROM OLD.rent_locked_amount) THEN
    RAISE EXCEPTION 'Approved rent for this property is locked. Submit a Rent Increase Application to change it.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_property_rent_unlock ON public.properties;
CREATE TRIGGER trg_prevent_property_rent_unlock
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.prevent_property_rent_unlock();
