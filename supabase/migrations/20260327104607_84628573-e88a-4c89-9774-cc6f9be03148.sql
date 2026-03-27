ALTER TABLE public.properties 
  ADD COLUMN IF NOT EXISTS duplicate_of_property_id uuid,
  ADD COLUMN IF NOT EXISTS duplicate_old_rent numeric;