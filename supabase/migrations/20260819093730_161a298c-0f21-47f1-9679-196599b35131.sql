CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text := NULLIF(COALESCE(NEW.raw_user_meta_data->>'phone', ''), '');
  v_role text := NEW.raw_user_meta_data->>'role';
BEGIN
  -- A phone already used by another profile must never abort account creation:
  -- the unique index on profiles.phone would otherwise surface as
  -- "Database error creating new user" during admin/staff invites.
  IF v_phone IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.phone = v_phone AND p.user_id <> NEW.id
  ) THEN
    v_phone := NULL;
  END IF;

  BEGIN
    INSERT INTO public.profiles (user_id, full_name, phone, email)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(v_phone, ''),
      NEW.email
    )
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN unique_violation THEN
    -- Fall back to a minimal profile so the auth user is still created.
    INSERT INTO public.profiles (user_id, full_name, phone, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), '', NULL)
    ON CONFLICT (user_id) DO NOTHING;
  END;

  IF v_role IS NOT NULL THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, v_role::app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN others THEN
      NULL; -- invalid/unknown role must not block sign-up
    END;
  END IF;

  RETURN NEW;
END;
$$;