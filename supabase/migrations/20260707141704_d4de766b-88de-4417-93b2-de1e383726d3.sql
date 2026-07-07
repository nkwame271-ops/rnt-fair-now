
CREATE TABLE public.property_assessment_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  requester_role TEXT NOT NULL CHECK (requester_role IN ('landlord','tenant','agent','regulator')),
  landlord_user_id UUID,
  reason TEXT,
  fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  fee_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (fee_status IN ('unpaid','paid','waived')),
  payment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','scheduled','inspected','certified','rejected','cancelled')),
  scheduled_at TIMESTAMPTZ,
  assigned_inspector UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_assessment_applications TO authenticated;
GRANT ALL ON public.property_assessment_applications TO service_role;
ALTER TABLE public.property_assessment_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessment_apps_select_own"
ON public.property_assessment_applications FOR SELECT TO authenticated
USING (
  requested_by = auth.uid()
  OR landlord_user_id = auth.uid()
  OR public.is_main_admin(auth.uid())
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.landlord_user_id = auth.uid())
);

CREATE POLICY "assessment_apps_insert_self"
ON public.property_assessment_applications FOR INSERT TO authenticated
WITH CHECK (requested_by = auth.uid());

CREATE POLICY "assessment_apps_update_admin_or_owner"
ON public.property_assessment_applications FOR UPDATE TO authenticated
USING (public.is_main_admin(auth.uid()) OR requested_by = auth.uid() OR landlord_user_id = auth.uid())
WITH CHECK (public.is_main_admin(auth.uid()) OR requested_by = auth.uid() OR landlord_user_id = auth.uid());

CREATE POLICY "assessment_apps_delete_admin"
ON public.property_assessment_applications FOR DELETE TO authenticated
USING (public.is_main_admin(auth.uid()));

CREATE INDEX idx_pa_apps_property ON public.property_assessment_applications(property_id);
CREATE INDEX idx_pa_apps_status ON public.property_assessment_applications(status);
CREATE INDEX idx_pa_apps_requester ON public.property_assessment_applications(requested_by);

CREATE TABLE public.property_assessment_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.property_assessment_applications(id) ON DELETE CASCADE,
  inspector_user_id UUID NOT NULL,
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL CHECK (outcome IN ('pass','fail','needs_recheck')),
  findings TEXT,
  photo_urls TEXT[] DEFAULT '{}'::text[],
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_assessment_inspections TO authenticated;
GRANT ALL ON public.property_assessment_inspections TO service_role;
ALTER TABLE public.property_assessment_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessment_insp_select_related"
ON public.property_assessment_inspections FOR SELECT TO authenticated
USING (
  public.is_main_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.property_assessment_applications a
    WHERE a.id = application_id
      AND (a.requested_by = auth.uid() OR a.landlord_user_id = auth.uid())
  )
);

CREATE POLICY "assessment_insp_write_admin"
ON public.property_assessment_inspections FOR ALL TO authenticated
USING (public.is_main_admin(auth.uid()))
WITH CHECK (public.is_main_admin(auth.uid()));

CREATE INDEX idx_pa_insp_app ON public.property_assessment_inspections(application_id);

CREATE TABLE public.property_assessment_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.property_assessment_applications(id) ON DELETE CASCADE,
  inspection_id UUID REFERENCES public.property_assessment_inspections(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_user_id UUID,
  certificate_number TEXT NOT NULL UNIQUE,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid','expired','revoked')),
  revoked_reason TEXT,
  renewal_reminder_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_assessment_certificates TO authenticated;
GRANT SELECT ON public.property_assessment_certificates TO anon;
GRANT ALL ON public.property_assessment_certificates TO service_role;
ALTER TABLE public.property_assessment_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assessment_cert_public_verify"
ON public.property_assessment_certificates FOR SELECT TO anon USING (true);

CREATE POLICY "assessment_cert_select_all_auth"
ON public.property_assessment_certificates FOR SELECT TO authenticated USING (true);

CREATE POLICY "assessment_cert_write_admin"
ON public.property_assessment_certificates FOR ALL TO authenticated
USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE INDEX idx_pa_cert_property ON public.property_assessment_certificates(property_id);
CREATE INDEX idx_pa_cert_qr ON public.property_assessment_certificates(qr_token);

CREATE TRIGGER trg_pa_apps_updated BEFORE UPDATE ON public.property_assessment_applications
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pa_insp_updated BEFORE UPDATE ON public.property_assessment_inspections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pa_cert_updated BEFORE UPDATE ON public.property_assessment_certificates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_assessment_certificate_number()
RETURNS TEXT LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE n TEXT;
BEGIN
  LOOP
    n := 'PAC-' || to_char(now(), 'YYYY') || '-' || upper(substr(encode(gen_random_bytes(4),'hex'),1,8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.property_assessment_certificates WHERE certificate_number = n);
  END LOOP;
  RETURN n;
END $$;
