-- Add user_type to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type TEXT NOT NULL DEFAULT 'tenant'
    CHECK (user_type IN ('tenant', 'student', 'landlord'));

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type);

-- Backfill from existing tenants/landlords records
UPDATE public.profiles p
SET user_type = 'student'
FROM public.tenants t
WHERE t.user_id = p.user_id
  AND t.is_student = true
  AND p.user_type <> 'student';

UPDATE public.profiles p
SET user_type = 'landlord'
FROM public.landlords l
WHERE l.user_id = p.user_id
  AND p.user_type = 'tenant'
  AND NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.user_id = p.user_id);