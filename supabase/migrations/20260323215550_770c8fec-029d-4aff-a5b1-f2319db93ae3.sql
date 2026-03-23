
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS suggested_price numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS property_structure text DEFAULT 'multi_unit';
