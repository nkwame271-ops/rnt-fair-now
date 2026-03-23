
-- Add new columns to properties table for Phase 1+2
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS property_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_reason text,
  ADD COLUMN IF NOT EXISTS room_count integer,
  ADD COLUMN IF NOT EXISTS bathroom_count integer,
  ADD COLUMN IF NOT EXISTS occupancy_type text,
  ADD COLUMN IF NOT EXISTS furnishing_status text DEFAULT 'unfurnished',
  ADD COLUMN IF NOT EXISTS ownership_type text DEFAULT 'owner',
  ADD COLUMN IF NOT EXISTS normalized_address text,
  ADD COLUMN IF NOT EXISTS property_fingerprint text;

-- Set existing properties to 'approved' status if they were already assessed
UPDATE public.properties SET property_status = 'approved' WHERE assessment_status = 'approved';
UPDATE public.properties SET property_status = 'pending_assessment' WHERE assessment_status != 'approved';

-- Create rent_benchmarks table
CREATE TABLE public.rent_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  zone_key text NOT NULL,
  property_class text NOT NULL,
  benchmark_min numeric NOT NULL DEFAULT 0,
  benchmark_expected numeric NOT NULL DEFAULT 0,
  benchmark_max numeric NOT NULL DEFAULT 0,
  soft_cap numeric NOT NULL DEFAULT 0,
  hard_cap numeric NOT NULL DEFAULT 0,
  confidence text NOT NULL DEFAULT 'low',
  comparable_count integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords read own benchmarks" ON public.rent_benchmarks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = rent_benchmarks.property_id AND properties.landlord_user_id = auth.uid())
  );

CREATE POLICY "Regulators read all benchmarks" ON public.rent_benchmarks
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages benchmarks" ON public.rent_benchmarks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Create rent_increase_requests table
CREATE TABLE public.rent_increase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  landlord_user_id uuid NOT NULL,
  current_approved_rent numeric NOT NULL DEFAULT 0,
  proposed_rent numeric NOT NULL,
  reason text,
  evidence_urls text[] DEFAULT '{}'::text[],
  request_type text NOT NULL DEFAULT 'new_tenancy',
  status text NOT NULL DEFAULT 'pending',
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_increase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage own rent increase requests" ON public.rent_increase_requests
  FOR ALL USING (auth.uid() = landlord_user_id) WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all rent increase requests" ON public.rent_increase_requests
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators update rent increase requests" ON public.rent_increase_requests
  FOR UPDATE USING (has_role(auth.uid(), 'regulator'::app_role));

-- Create property_events table
CREATE TABLE public.property_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  old_value jsonb DEFAULT '{}'::jsonb,
  new_value jsonb DEFAULT '{}'::jsonb,
  performed_by uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.property_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read all property events" ON public.property_events
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Landlords read own property events" ON public.property_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.properties WHERE properties.id = property_events.property_id AND properties.landlord_user_id = auth.uid())
  );

CREATE POLICY "Service role manages property events" ON public.property_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated insert property events" ON public.property_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = performed_by);

-- Create rent_market_data table
CREATE TABLE public.rent_market_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.units(id) ON DELETE CASCADE,
  zone_key text NOT NULL,
  property_class text NOT NULL,
  asking_rent numeric,
  approved_rent numeric,
  accepted_rent numeric,
  advance_months integer,
  event_type text NOT NULL DEFAULT 'listing',
  event_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read all market data" ON public.rent_market_data
  FOR SELECT USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages market data" ON public.rent_market_data
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated insert market data" ON public.rent_market_data
  FOR INSERT TO authenticated WITH CHECK (true);
