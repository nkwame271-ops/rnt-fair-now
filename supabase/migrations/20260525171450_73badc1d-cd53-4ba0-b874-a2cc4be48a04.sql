-- New optional hostel context columns on tenants
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS hostel_region text,
  ADD COLUMN IF NOT EXISTS hostel_contact_number text,
  ADD COLUMN IF NOT EXISTS hostel_landlord_name text,
  ADD COLUMN IF NOT EXISTS ghana_post_gps text,
  ADD COLUMN IF NOT EXISTS hostel_location_address text,
  ADD COLUMN IF NOT EXISTS hostel_location_lat numeric,
  ADD COLUMN IF NOT EXISTS hostel_location_lng numeric;

-- Mirror onto residence history so snapshots preserve the full picture
ALTER TABLE public.student_residence_history
  ADD COLUMN IF NOT EXISTS hostel_region text,
  ADD COLUMN IF NOT EXISTS hostel_contact_number text,
  ADD COLUMN IF NOT EXISTS hostel_landlord_name text,
  ADD COLUMN IF NOT EXISTS ghana_post_gps text,
  ADD COLUMN IF NOT EXISTS hostel_location_address text,
  ADD COLUMN IF NOT EXISTS hostel_location_lat numeric,
  ADD COLUMN IF NOT EXISTS hostel_location_lng numeric;

-- Update snapshot trigger so hostel-context changes also create a history row,
-- and persist the new fields into the snapshot.
CREATE OR REPLACE FUNCTION public.snapshot_student_residence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.is_student IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND
     COALESCE(NEW.school, '') = COALESCE(OLD.school, '') AND
     COALESCE(NEW.hostel_or_hall, '') = COALESCE(OLD.hostel_or_hall, '') AND
     COALESCE(NEW.room_or_bed_space, '') = COALESCE(OLD.room_or_bed_space, '') AND
     COALESCE(NEW.hostel_region, '') = COALESCE(OLD.hostel_region, '') AND
     COALESCE(NEW.hostel_contact_number, '') = COALESCE(OLD.hostel_contact_number, '') AND
     COALESCE(NEW.hostel_landlord_name, '') = COALESCE(OLD.hostel_landlord_name, '') AND
     COALESCE(NEW.ghana_post_gps, '') = COALESCE(OLD.ghana_post_gps, '') AND
     COALESCE(NEW.hostel_location_address, '') = COALESCE(OLD.hostel_location_address, '') AND
     COALESCE(NEW.hostel_location_lat, 0) = COALESCE(OLD.hostel_location_lat, 0) AND
     COALESCE(NEW.hostel_location_lng, 0) = COALESCE(OLD.hostel_location_lng, 0) THEN
    RETURN NEW;
  END IF;

  UPDATE public.student_residence_history
  SET effective_to = now()
  WHERE tenant_user_id = NEW.user_id
    AND effective_to IS NULL;

  INSERT INTO public.student_residence_history (
    tenant_user_id, school, hostel_or_hall, room_or_bed_space, changed_by,
    hostel_region, hostel_contact_number, hostel_landlord_name,
    ghana_post_gps, hostel_location_address, hostel_location_lat, hostel_location_lng
  ) VALUES (
    NEW.user_id, NEW.school, NEW.hostel_or_hall, NEW.room_or_bed_space, auth.uid(),
    NEW.hostel_region, NEW.hostel_contact_number, NEW.hostel_landlord_name,
    NEW.ghana_post_gps, NEW.hostel_location_address, NEW.hostel_location_lat, NEW.hostel_location_lng
  );

  RETURN NEW;
END;
$function$;

-- Replace trigger with extended column watchlist
DROP TRIGGER IF EXISTS trg_snapshot_student_residence ON public.tenants;
CREATE TRIGGER trg_snapshot_student_residence
AFTER INSERT OR UPDATE OF
  school, hostel_or_hall, room_or_bed_space, is_student,
  hostel_region, hostel_contact_number, hostel_landlord_name,
  ghana_post_gps, hostel_location_address, hostel_location_lat, hostel_location_lng
ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_student_residence();