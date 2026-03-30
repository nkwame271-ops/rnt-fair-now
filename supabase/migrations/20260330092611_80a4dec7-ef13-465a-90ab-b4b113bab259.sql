
CREATE OR REPLACE FUNCTION public.handle_tenancy_rejection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_unit_id uuid;
  v_property_id uuid;
  v_occupied_count integer;
BEGIN
  IF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    v_unit_id := NEW.unit_id;
    UPDATE units SET status = 'vacant' WHERE id = v_unit_id;
    SELECT property_id INTO v_property_id FROM units WHERE id = v_unit_id;
    IF v_property_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_occupied_count
      FROM units
      WHERE property_id = v_property_id AND status = 'occupied';
      IF v_occupied_count = 0 THEN
        UPDATE properties
        SET property_status = 'live', listed_on_marketplace = true
        WHERE id = v_property_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tenancy_rejected
  AFTER UPDATE ON tenancies
  FOR EACH ROW
  EXECUTE FUNCTION handle_tenancy_rejection();
