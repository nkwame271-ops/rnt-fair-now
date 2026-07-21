
ALTER TABLE public.pending_assessment_drafts
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS ghana_post_gps text,
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS landmark text,
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE public.property_assessment_applications
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS ghana_post_gps text,
  ADD COLUMN IF NOT EXISTS address_line text,
  ADD COLUMN IF NOT EXISTS landmark text,
  ALTER COLUMN property_id DROP NOT NULL;
