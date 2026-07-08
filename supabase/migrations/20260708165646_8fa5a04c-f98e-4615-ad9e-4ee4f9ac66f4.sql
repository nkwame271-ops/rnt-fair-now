
ALTER TABLE public.safety_reports
  ADD COLUMN IF NOT EXISTS written_directions TEXT,
  ADD COLUMN IF NOT EXISTS nearest_landmark TEXT,
  ADD COLUMN IF NOT EXISTS location_unknown BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS person_involved TEXT,
  ADD COLUMN IF NOT EXISTS incident_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT false;
