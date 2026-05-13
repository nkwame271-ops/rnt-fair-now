-- Cache table for GhanaPostGPS lookups
CREATE TABLE IF NOT EXISTS public.ghana_post_gps_cache (
  code text PRIMARY KEY,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  region text,
  district text,
  area text,
  formatted text,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghana_post_gps_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read GhanaPostGPS cache"
  ON public.ghana_post_gps_cache FOR SELECT
  USING (true);

-- (writes happen via service role only — no insert/update/delete policies)

-- Property location validation columns
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS location_review_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS location_distance_m integer,
  ADD COLUMN IF NOT EXISTS ghana_post_gps_lat numeric,
  ADD COLUMN IF NOT EXISTS ghana_post_gps_lng numeric;

CREATE INDEX IF NOT EXISTS idx_properties_location_review
  ON public.properties (location_review_required)
  WHERE location_review_required = true;
