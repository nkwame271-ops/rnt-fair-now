-- 1. Drop the single-column unique on rent_cards.serial_number
-- This blocks the paired model where 2 cards share one serial
ALTER TABLE public.rent_cards DROP CONSTRAINT IF EXISTS rent_cards_serial_number_key;

-- 2. Fix enforce_serial_assignment trigger to allow clearing serial (unassign)
-- Currently blocks setting serial_number to NULL which prevents unassign
CREATE OR REPLACE FUNCTION public.enforce_serial_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only block when ASSIGNING a serial (non-null), not when clearing it
  IF NEW.serial_number IS DISTINCT FROM OLD.serial_number
     AND NEW.serial_number IS NOT NULL THEN
    IF NOT has_role(auth.uid(), 'regulator'::app_role) THEN
      RAISE EXCEPTION 'Only regulators can assign serial numbers';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;