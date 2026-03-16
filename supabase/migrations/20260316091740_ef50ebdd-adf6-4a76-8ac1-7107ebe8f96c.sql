
-- 1. Add tax_rates JSONB to agreement_template_config
ALTER TABLE public.agreement_template_config 
  ADD COLUMN tax_rates jsonb NOT NULL DEFAULT '{"residential": 8, "commercial": 15}'::jsonb;

-- Migrate existing tax_rate value into tax_rates
UPDATE public.agreement_template_config 
  SET tax_rates = jsonb_build_object('residential', tax_rate, 'commercial', 15);

-- 2. Create feature_flags table
CREATE TABLE public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read feature flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Regulators can manage feature flags"
  ON public.feature_flags FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'))
  WITH CHECK (public.has_role(auth.uid(), 'regulator'));

-- Seed initial feature flags
INSERT INTO public.feature_flags (feature_key, label, description, is_enabled) VALUES
  ('rent_assessment', 'Rent Assessment', 'Allow landlords to submit rent increase applications for Rent Control review', false),
  ('legal_assistant', 'Legal Assistant', 'AI-powered legal guidance for tenants on rental law questions', true),
  ('marketplace', 'Property Marketplace', 'Public listing of available rental properties for tenants to browse', true),
  ('kyc_verification', 'KYC Verification', 'Identity verification using Ghana Card and selfie matching', true),
  ('complaint_filing', 'Complaint Filing', 'Allow tenants to file formal complaints against landlords', true),
  ('rent_checker', 'Rent Checker', 'AI tool to check if rent is fair based on location and property type', true),
  ('viewing_requests', 'Viewing Requests', 'Allow tenants to request property viewings through the platform', true);

-- 3. Add assessment columns to properties
ALTER TABLE public.properties
  ADD COLUMN assessment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN assessed_at timestamptz,
  ADD COLUMN assessed_by uuid;

-- 4. Create rent_assessments table
CREATE TABLE public.rent_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  landlord_user_id uuid NOT NULL,
  current_rent numeric NOT NULL,
  proposed_rent numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rent_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage own rent assessments"
  ON public.rent_assessments FOR ALL
  TO authenticated
  USING (auth.uid() = landlord_user_id)
  WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all rent assessments"
  ON public.rent_assessments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Regulators update rent assessments"
  ON public.rent_assessments FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Tenants read own tenancy assessments"
  ON public.rent_assessments FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenancies 
    WHERE tenancies.id = rent_assessments.tenancy_id 
    AND tenancies.tenant_user_id = auth.uid()
  ));

-- Allow regulators to update properties (for assessment approval)
CREATE POLICY "Regulators can update properties"
  ON public.properties FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));
