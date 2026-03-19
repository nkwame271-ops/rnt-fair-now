
-- 1. Trigger: Block non-regulator UPDATE of serial_number on rent_cards
CREATE OR REPLACE FUNCTION public.enforce_serial_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number THEN
    IF NOT has_role(auth.uid(), 'regulator'::app_role) THEN
      RAISE EXCEPTION 'Only regulators can assign serial numbers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_serial_assignment
  BEFORE UPDATE ON public.rent_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_serial_assignment();

-- 2. Trigger: Block INSERT with non-null serial_number by non-regulators
CREATE OR REPLACE FUNCTION public.enforce_serial_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.serial_number IS NOT NULL THEN
    IF NOT has_role(auth.uid(), 'regulator'::app_role) THEN
      RAISE EXCEPTION 'Serial numbers can only be set by regulators';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_serial_on_insert
  BEFORE INSERT ON public.rent_cards
  FOR EACH ROW EXECUTE FUNCTION public.enforce_serial_on_insert();

-- 3. Add office_id to serial_assignments
ALTER TABLE public.serial_assignments ADD COLUMN IF NOT EXISTS office_id text;

-- 4. Drop the generate_rent_card_serial function (no longer used)
DROP FUNCTION IF EXISTS public.generate_rent_card_serial();
