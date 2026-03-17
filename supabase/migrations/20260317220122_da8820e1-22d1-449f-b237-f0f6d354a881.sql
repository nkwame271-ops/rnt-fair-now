ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS proposed_rent numeric,
  ADD COLUMN IF NOT EXISTS renewal_duration_months integer;