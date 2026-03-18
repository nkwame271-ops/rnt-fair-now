
-- Unique index on profiles.phone (one phone = one account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_phone_unique 
  ON public.profiles (phone) WHERE phone IS NOT NULL AND phone != '';

-- Unique index on profiles.email (one real email = one account)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_email_unique 
  ON public.profiles (email) WHERE email IS NOT NULL AND email != '' AND email NOT LIKE '%@rentcontrolghana.local';

-- Ghana Card per-role validation trigger
CREATE OR REPLACE FUNCTION public.check_ghana_card_uniqueness()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ghana_card_no IS NOT NULL AND NEW.ghana_card_no != '' THEN
    IF EXISTS (
      SELECT 1 FROM profiles p
      JOIN user_roles ur ON ur.user_id = p.user_id
      WHERE p.ghana_card_no = NEW.ghana_card_no
        AND p.user_id != NEW.user_id
        AND ur.role = (SELECT role FROM user_roles WHERE user_id = NEW.user_id LIMIT 1)
    ) THEN
      RAISE EXCEPTION 'Ghana Card already registered for this role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_ghana_card
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.check_ghana_card_uniqueness();
