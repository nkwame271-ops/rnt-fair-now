
-- OTP verifications table
CREATE TABLE public.otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages otp_verifications" ON public.otp_verifications FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Anon can insert otp_verifications" ON public.otp_verifications FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anon can read otp_verifications" ON public.otp_verifications FOR SELECT TO anon, authenticated USING (true);

-- Tenancy signatures table
CREATE TABLE public.tenancy_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  signer_user_id uuid NOT NULL,
  signer_role text NOT NULL,
  signature_method text NOT NULL DEFAULT 'password',
  device_info jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  signature_hash text
);

ALTER TABLE public.tenancy_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own signatures" ON public.tenancy_signatures FOR SELECT TO authenticated
  USING (signer_user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM tenancies WHERE tenancies.id = tenancy_signatures.tenancy_id AND (tenancies.landlord_user_id = auth.uid() OR tenancies.tenant_user_id = auth.uid())
  ));
CREATE POLICY "Authenticated insert signatures" ON public.tenancy_signatures FOR INSERT TO authenticated WITH CHECK (signer_user_id = auth.uid());
CREATE POLICY "Regulators read all signatures" ON public.tenancy_signatures FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Service role manages signatures" ON public.tenancy_signatures FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add columns to tenancies for signature workflow
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS landlord_signed_at timestamp with time zone;
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS tenant_signed_at timestamp with time zone;
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS agreement_version integer NOT NULL DEFAULT 1;
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS final_agreement_pdf_url text;
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS execution_timestamp timestamp with time zone;

-- Complaint schedules table
CREATE TABLE public.complaint_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  complaint_type text NOT NULL DEFAULT 'tenant',
  created_by uuid NOT NULL,
  available_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_slot jsonb,
  selected_by uuid,
  selected_at timestamp with time zone,
  status text NOT NULL DEFAULT 'pending_selection',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.complaint_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage complaint_schedules" ON public.complaint_schedules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role)) WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Users read own complaint schedules" ON public.complaint_schedules FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM complaints WHERE complaints.id = complaint_schedules.complaint_id AND complaints.tenant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM landlord_complaints WHERE landlord_complaints.id = complaint_schedules.complaint_id AND landlord_complaints.landlord_user_id = auth.uid())
  );
CREATE POLICY "Users update own complaint schedules" ON public.complaint_schedules FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM complaints WHERE complaints.id = complaint_schedules.complaint_id AND complaints.tenant_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM landlord_complaints WHERE landlord_complaints.id = complaint_schedules.complaint_id AND landlord_complaints.landlord_user_id = auth.uid())
  );
CREATE POLICY "Service role manages complaint_schedules" ON public.complaint_schedules FOR ALL TO service_role USING (true) WITH CHECK (true);
