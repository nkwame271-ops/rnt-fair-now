
-- Backfill: existing_migration rows wrongly using landlord as tenant
UPDATE public.tenancies t
SET tenant_user_id = NULL,
    placeholder_tenant_name = COALESCE(t.placeholder_tenant_name, pt.full_name, 'Pending Tenant'),
    placeholder_tenant_phone = COALESCE(t.placeholder_tenant_phone, pt.phone),
    pending_tenant_id = COALESCE(t.pending_tenant_id, pt.id)
FROM (
  SELECT DISTINCT ON (tenancy_id) id, tenancy_id, full_name, phone
  FROM public.pending_tenants
  WHERE tenancy_id IS NOT NULL
  ORDER BY tenancy_id, created_at DESC
) pt
WHERE t.id = pt.tenancy_id
  AND t.tenancy_type = 'existing_migration'
  AND t.tenant_accepted = false
  AND t.tenant_user_id = t.landlord_user_id;

-- Also nullify rows that have placeholder name set but tenant_user_id still equals landlord
UPDATE public.tenancies
SET tenant_user_id = NULL
WHERE tenancy_type = 'existing_migration'
  AND tenant_accepted = false
  AND tenant_user_id = landlord_user_id
  AND placeholder_tenant_name IS NOT NULL;

-- Ensure pending_tenants link columns exist
ALTER TABLE public.pending_tenants
  ADD COLUMN IF NOT EXISTS linked_user_id uuid,
  ADD COLUMN IF NOT EXISTS linked_at timestamptz;

-- Auto-link trigger: when a profile is inserted, link any waiting tenancies by normalised phone
CREATE OR REPLACE FUNCTION public.link_existing_tenancy_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_count int;
BEGIN
  IF NEW.phone IS NULL OR NEW.phone = '' THEN
    RETURN NEW;
  END IF;
  -- Normalise to 233XXXXXXXXX
  v_norm := regexp_replace(NEW.phone, '\D', '', 'g');
  IF length(v_norm) = 10 AND left(v_norm, 1) = '0' THEN
    v_norm := '233' || substring(v_norm from 2);
  ELSIF length(v_norm) = 9 THEN
    v_norm := '233' || v_norm;
  END IF;

  UPDATE public.tenancies
  SET tenant_user_id = NEW.user_id,
      placeholder_tenant_name = NULL,
      placeholder_tenant_phone = NULL
  WHERE tenant_user_id IS NULL
    AND placeholder_tenant_phone IS NOT NULL
    AND regexp_replace(placeholder_tenant_phone, '\D', '', 'g') IN (v_norm, substring(v_norm from 4), '0' || substring(v_norm from 4));

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE public.pending_tenants
    SET linked_user_id = NEW.user_id, linked_at = now()
    WHERE linked_user_id IS NULL
      AND regexp_replace(phone, '\D', '', 'g') IN (v_norm, substring(v_norm from 4), '0' || substring(v_norm from 4));

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (NEW.user_id,
            'Existing Tenancy Awaiting Your Acceptance',
            'A landlord declared an existing tenancy for you. Review and accept it in My Agreements.',
            '/tenant/my-agreements');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_link_existing_tenancy_on_signup ON public.profiles;
CREATE TRIGGER trg_link_existing_tenancy_on_signup
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.link_existing_tenancy_on_signup();
