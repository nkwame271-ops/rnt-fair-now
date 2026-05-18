
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complainants jsonb,
  ADD COLUMN IF NOT EXISTS respondents jsonb,
  ADD COLUMN IF NOT EXISTS premises_house_no text,
  ADD COLUMN IF NOT EXISTS premises_town text,
  ADD COLUMN IF NOT EXISTS complainant_address text,
  ADD COLUMN IF NOT EXISTS complainant_gps_lat numeric,
  ADD COLUMN IF NOT EXISTS complainant_gps_lng numeric,
  ADD COLUMN IF NOT EXISTS agreement_expiry_date date,
  ADD COLUMN IF NOT EXISTS deposit_amount numeric,
  ADD COLUMN IF NOT EXISTS occupied_months integer,
  ADD COLUMN IF NOT EXISTS tenants_intent text,
  ADD COLUMN IF NOT EXISTS relief_sought text,
  ADD COLUMN IF NOT EXISTS case_number text,
  ADD COLUMN IF NOT EXISTS hearing_venue text,
  ADD COLUMN IF NOT EXISTS hearing_officer_name text,
  ADD COLUMN IF NOT EXISTS summons_issued_at timestamptz;

CREATE SEQUENCE IF NOT EXISTS public.car_case_number_seq START 2700;

CREATE OR REPLACE FUNCTION public.issue_car_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'CAR ' || nextval('public.car_case_number_seq')::text || '/' || to_char(now(), 'YYYY');
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_complaints_case_number ON public.complaints(case_number) WHERE case_number IS NOT NULL;
