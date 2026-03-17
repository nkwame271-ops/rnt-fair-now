
ALTER TABLE public.tenancies
  ADD COLUMN IF NOT EXISTS tenancy_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS previous_tenancy_id uuid,
  ADD COLUMN IF NOT EXISTS renewal_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_requested_by uuid,
  ADD COLUMN IF NOT EXISTS termination_reason text,
  ADD COLUMN IF NOT EXISTS terminated_at timestamptz,
  ADD COLUMN IF NOT EXISTS existing_advance_paid integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS existing_start_date date,
  ADD COLUMN IF NOT EXISTS existing_agreement_url text,
  ADD COLUMN IF NOT EXISTS existing_voice_url text,
  ADD COLUMN IF NOT EXISTS compliance_status text NOT NULL DEFAULT 'compliant';

ALTER TABLE public.landlords
  ADD COLUMN IF NOT EXISTS compliance_score integer NOT NULL DEFAULT 100;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS approved_rent numeric,
  ADD COLUMN IF NOT EXISTS last_assessment_id uuid;

CREATE TABLE public.property_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  inspector_user_id uuid,
  photos text[] DEFAULT '{}',
  gps_location text,
  amenities jsonb DEFAULT '{}',
  property_condition text,
  recommended_rent numeric,
  approved_rent numeric,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending'
);

ALTER TABLE public.property_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage assessments" ON public.property_assessments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'))
  WITH CHECK (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Landlords read own property assessments" ON public.property_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.properties WHERE properties.id = property_assessments.property_id
    AND properties.landlord_user_id = auth.uid()
  ));

CREATE POLICY "Tenants read assessments for their tenancies" ON public.property_assessments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenancies t
    JOIN public.units u ON u.id = t.unit_id
    WHERE u.property_id = property_assessments.property_id
    AND t.tenant_user_id = auth.uid()
  ));

CREATE TABLE public.illegal_payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attempted_amount numeric NOT NULL,
  max_lawful_amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text
);

ALTER TABLE public.illegal_payment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read all illegal attempts" ON public.illegal_payment_attempts
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "System inserts illegal attempts" ON public.illegal_payment_attempts
  FOR INSERT TO authenticated
  WITH CHECK (true);
