-- Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Backfill student_housing for properties whose units indicate hostel/hall
UPDATE public.properties p
SET property_category = 'student_housing'
WHERE (p.property_category IS NULL OR p.property_category <> 'student_housing')
  AND EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.property_id = p.id
      AND (u.unit_type ILIKE '%hostel%' OR u.unit_type ILIKE '%hall of residence%')
  );

-- complaint_properties: full property snapshot per complaint
CREATE TABLE IF NOT EXISTS public.complaint_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID,
  tenant_user_id UUID NOT NULL,
  landlord_name TEXT NOT NULL,
  property_name TEXT,
  property_type TEXT NOT NULL,
  unit_description TEXT,
  monthly_rent NUMERIC NOT NULL DEFAULT 0,
  address_description TEXT,
  lat NUMERIC,
  lng NUMERIC,
  gps_code TEXT,
  place_name TEXT,
  place_id TEXT,
  location_method TEXT NOT NULL CHECK (location_method IN ('live','gps_code','map_search')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_complaint_properties_complaint_id ON public.complaint_properties(complaint_id);
CREATE INDEX IF NOT EXISTS idx_complaint_properties_tenant ON public.complaint_properties(tenant_user_id);
CREATE INDEX IF NOT EXISTS idx_complaint_properties_landlord_name_trgm
  ON public.complaint_properties USING GIN (landlord_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_complaint_properties_property_name_trgm
  ON public.complaint_properties USING GIN (property_name gin_trgm_ops);

ALTER TABLE public.complaint_properties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants insert their own complaint properties" ON public.complaint_properties;
CREATE POLICY "Tenants insert their own complaint properties"
ON public.complaint_properties FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = tenant_user_id);

DROP POLICY IF EXISTS "Tenants view their own complaint properties" ON public.complaint_properties;
CREATE POLICY "Tenants view their own complaint properties"
ON public.complaint_properties FOR SELECT
TO authenticated
USING (auth.uid() = tenant_user_id);

DROP POLICY IF EXISTS "Admins view all complaint properties" ON public.complaint_properties;
CREATE POLICY "Admins view all complaint properties"
ON public.complaint_properties FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'regulator'::app_role) OR public.is_main_admin(auth.uid()));

-- Add complaint_property_id FK to complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS complaint_property_id UUID REFERENCES public.complaint_properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_complaints_complaint_property_id ON public.complaints(complaint_property_id);

-- property_similarity_scores
CREATE TABLE IF NOT EXISTS public.property_similarity_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_type TEXT NOT NULL CHECK (source_type IN ('complaint_property')),
  source_id UUID NOT NULL,
  matched_property_id UUID NOT NULL,
  score NUMERIC NOT NULL,
  similarity_level TEXT NOT NULL CHECK (similarity_level IN ('high','medium','low')),
  gps_points NUMERIC NOT NULL DEFAULT 0,
  landlord_name_points NUMERIC NOT NULL DEFAULT 0,
  property_name_points NUMERIC NOT NULL DEFAULT 0,
  property_type_points NUMERIC NOT NULL DEFAULT 0,
  location_points NUMERIC NOT NULL DEFAULT 0,
  tenant_boost_applied BOOLEAN NOT NULL DEFAULT false,
  last_calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  manually_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_by UUID,
  dismissed_at TIMESTAMPTZ,
  CONSTRAINT property_similarity_scores_unique UNIQUE (source_id, matched_property_id)
);

CREATE INDEX IF NOT EXISTS idx_pss_matched_active
  ON public.property_similarity_scores (matched_property_id, similarity_level)
  WHERE manually_dismissed = false;
CREATE INDEX IF NOT EXISTS idx_pss_source ON public.property_similarity_scores(source_id);

ALTER TABLE public.property_similarity_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view all similarity scores" ON public.property_similarity_scores;
CREATE POLICY "Admins view all similarity scores"
ON public.property_similarity_scores FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'regulator'::app_role) OR public.is_main_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins update similarity dismissals" ON public.property_similarity_scores;
CREATE POLICY "Admins update similarity dismissals"
ON public.property_similarity_scores FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'regulator'::app_role) OR public.is_main_admin(auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'regulator'::app_role) OR public.is_main_admin(auth.uid()));

-- similarity_check_errors log
CREATE TABLE IF NOT EXISTS public.similarity_check_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID,
  error_message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.similarity_check_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins view similarity errors" ON public.similarity_check_errors;
CREATE POLICY "Admins view similarity errors"
ON public.similarity_check_errors FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'regulator'::app_role) OR public.is_main_admin(auth.uid()));