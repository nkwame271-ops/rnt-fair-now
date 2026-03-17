
-- Termination applications table
CREATE TABLE public.termination_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  applicant_user_id uuid NOT NULL,
  applicant_role text NOT NULL,
  reason text NOT NULL,
  description text,
  evidence_urls text[] DEFAULT '{}',
  audio_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.termination_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Applicants manage own termination apps" ON public.termination_applications
  FOR ALL TO authenticated
  USING (auth.uid() = applicant_user_id)
  WITH CHECK (auth.uid() = applicant_user_id);

CREATE POLICY "Regulators read all termination apps" ON public.termination_applications
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators update termination apps" ON public.termination_applications
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Participants read termination apps for their tenancies" ON public.termination_applications
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tenancies
    WHERE tenancies.id = termination_applications.tenancy_id
    AND (tenancies.tenant_user_id = auth.uid() OR tenancies.landlord_user_id = auth.uid())
  ));

-- Side-payment declarations table
CREATE TABLE public.side_payment_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL,
  declared_by uuid NOT NULL,
  amount numeric NOT NULL,
  payment_type text NOT NULL,
  description text,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'reported',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.side_payment_declarations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Declarers manage own side payments" ON public.side_payment_declarations
  FOR ALL TO authenticated
  USING (auth.uid() = declared_by)
  WITH CHECK (auth.uid() = declared_by);

CREATE POLICY "Regulators read all side payments" ON public.side_payment_declarations
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators update side payments" ON public.side_payment_declarations
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Compliance score recalculation function
CREATE OR REPLACE FUNCTION public.recalculate_compliance_score(p_landlord_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  penalty integer := 0;
  new_score integer;
BEGIN
  -- -10 per illegal payment attempt (from tenancies owned by this landlord)
  SELECT COALESCE(COUNT(*), 0) * 10 INTO penalty
  FROM illegal_payment_attempts ipa
  JOIN tenancies t ON t.id = ipa.tenancy_id
  WHERE t.landlord_user_id = p_landlord_user_id;

  -- -15 per confirmed side-payment declaration
  penalty := penalty + (
    SELECT COALESCE(COUNT(*), 0) * 15
    FROM side_payment_declarations spd
    JOIN tenancies t ON t.id = spd.tenancy_id
    WHERE t.landlord_user_id = p_landlord_user_id
    AND spd.status = 'confirmed'
  );

  -- -20 per approved termination due to landlord fault
  penalty := penalty + (
    SELECT COALESCE(COUNT(*), 0) * 20
    FROM termination_applications ta
    JOIN tenancies t ON t.id = ta.tenancy_id
    WHERE t.landlord_user_id = p_landlord_user_id
    AND ta.status = 'approved'
    AND ta.applicant_role = 'tenant'
  );

  new_score := GREATEST(0, LEAST(100, 100 - penalty));

  UPDATE landlords SET compliance_score = new_score
  WHERE user_id = p_landlord_user_id;
END;
$$;
