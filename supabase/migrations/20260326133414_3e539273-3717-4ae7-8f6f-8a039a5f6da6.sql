ALTER TABLE public.kyc_verifications ADD COLUMN IF NOT EXISTS nia_verified boolean DEFAULT false;
ALTER TABLE public.kyc_verifications ADD COLUMN IF NOT EXISTS nia_response jsonb;