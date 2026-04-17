
-- 1. Soft-dissociation column
ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS tenant_archived_at timestamptz;

-- 2. Cascade helper: flips a single tenancy to expired and returns property to landlord
CREATE OR REPLACE FUNCTION public.expire_tenancy_cascade(p_tenancy_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit_id uuid;
  v_property_id uuid;
  v_tenant uuid;
  v_landlord uuid;
  v_code text;
  v_other_occupied int;
BEGIN
  SELECT unit_id, tenant_user_id, landlord_user_id, registration_code
    INTO v_unit_id, v_tenant, v_landlord, v_code
  FROM tenancies
  WHERE id = p_tenancy_id
    AND status IN ('active', 'renewal_window')
    AND end_date < CURRENT_DATE
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Flip tenancy + soft-dissociate tenant
  UPDATE tenancies
  SET status = 'expired',
      terminated_at = COALESCE(terminated_at, now()),
      termination_reason = COALESCE(termination_reason, 'auto_expired'),
      tenant_archived_at = COALESCE(tenant_archived_at, now())
  WHERE id = p_tenancy_id;

  -- Vacate unit
  IF v_unit_id IS NOT NULL THEN
    UPDATE units SET status = 'vacant' WHERE id = v_unit_id;
    SELECT property_id INTO v_property_id FROM units WHERE id = v_unit_id;

    IF v_property_id IS NOT NULL THEN
      SELECT count(*) INTO v_other_occupied
      FROM units
      WHERE property_id = v_property_id
        AND status = 'occupied'
        AND id <> v_unit_id;

      IF v_other_occupied = 0 THEN
        UPDATE properties
        SET property_status = 'off_market',
            listed_on_marketplace = false
        WHERE id = v_property_id;

        INSERT INTO property_events (
          property_id, event_type, old_value, new_value, performed_by, reason
        ) VALUES (
          v_property_id, 'status_change',
          jsonb_build_object('status', 'occupied'),
          jsonb_build_object('status', 'off_market'),
          NULL,
          'Tenancy ' || COALESCE(v_code, '') || ' expired — property available for relisting'
        );
      END IF;
    END IF;
  END IF;

  -- Notify both parties (idempotent enough — duplicates are acceptable on re-runs)
  INSERT INTO notifications (user_id, title, body, link)
  VALUES
    (v_tenant, 'Tenancy Expired',
     'Your tenancy ' || COALESCE(v_code, '') || ' has expired and moved to your Past Tenancies.',
     '/tenant/my-agreements'),
    (v_landlord, 'Tenancy Expired — Property Available',
     'Tenancy ' || COALESCE(v_code, '') || ' has expired. The property is now available for you to relist or hold.',
     '/landlord/my-properties');
END;
$$;

-- 3. Bulk helper used by the daily cron / edge function
CREATE OR REPLACE FUNCTION public.expire_overdue_tenancies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT id FROM tenancies
    WHERE status IN ('active', 'renewal_window')
      AND end_date < CURRENT_DATE
  LOOP
    PERFORM expire_tenancy_cascade(r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 4. Real-time trigger: any UPDATE on a past-end-date tenancy auto-flips it.
-- (SELECT cannot trigger writes in Postgres, so we rely on the daily cron + this trigger
-- which catches any client-side mutation, plus the client can call expire_tenancy_cascade directly.)
CREATE OR REPLACE FUNCTION public.auto_expire_on_touch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('active', 'renewal_window')
     AND NEW.end_date IS NOT NULL
     AND NEW.end_date < CURRENT_DATE THEN
    NEW.status := 'expired';
    NEW.terminated_at := COALESCE(NEW.terminated_at, now());
    NEW.termination_reason := COALESCE(NEW.termination_reason, 'auto_expired');
    NEW.tenant_archived_at := COALESCE(NEW.tenant_archived_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_expire_on_touch ON public.tenancies;
CREATE TRIGGER trg_auto_expire_on_touch
BEFORE INSERT OR UPDATE ON public.tenancies
FOR EACH ROW
EXECUTE FUNCTION public.auto_expire_on_touch();

-- 5. Backfill: process any already-overdue tenancies right now
SELECT public.expire_overdue_tenancies();
