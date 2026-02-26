
-- Add location verification fields to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS gps_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gps_confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ghana_post_gps text,
  ADD COLUMN IF NOT EXISTS location_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_locked_by uuid;

-- Create location edit audit log
CREATE TABLE IF NOT EXISTS public.property_location_edits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  edited_by uuid NOT NULL,
  old_gps_location text,
  new_gps_location text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_location_edits ENABLE ROW LEVEL SECURITY;

-- Only regulators can view location edit logs
CREATE POLICY "Regulators can read location edits"
  ON public.property_location_edits
  FOR SELECT
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Landlords can see their own property edits
CREATE POLICY "Landlords can read own property location edits"
  ON public.property_location_edits
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = property_location_edits.property_id
    AND properties.landlord_user_id = auth.uid()
  ));

-- Only regulators can insert edit records (admin override)
CREATE POLICY "Regulators can insert location edits"
  ON public.property_location_edits
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

-- Landlords can insert edit records for their own unlocked properties  
CREATE POLICY "Landlords can insert own location edits"
  ON public.property_location_edits
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM properties WHERE properties.id = property_location_edits.property_id
    AND properties.landlord_user_id = auth.uid()
    AND properties.location_locked = false
  ));
