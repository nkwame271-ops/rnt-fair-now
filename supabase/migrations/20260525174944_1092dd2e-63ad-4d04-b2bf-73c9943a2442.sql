
DROP POLICY IF EXISTS "Landlords can read related tenant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Tenants can read landlord profiles" ON public.profiles;
DROP POLICY IF EXISTS "NUGS admins read student profiles" ON public.profiles;

CREATE OR REPLACE VIEW public.profiles_counterparty
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  p.user_id, p.full_name, p.phone, p.email,
  p.avatar_url, p.occupation, p.nationality, p.user_type
FROM public.profiles p
WHERE
  auth.uid() IS NOT NULL
  AND (
    p.user_id = auth.uid()
    OR public.has_role(auth.uid(), 'regulator'::app_role)
    OR public.is_main_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'nugs_admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.tenancies t
      WHERE (t.landlord_user_id = auth.uid() AND t.tenant_user_id = p.user_id)
         OR (t.tenant_user_id   = auth.uid() AND t.landlord_user_id = p.user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.rental_applications ra
      WHERE (ra.landlord_user_id = auth.uid() AND ra.tenant_user_id = p.user_id)
         OR (ra.tenant_user_id   = auth.uid() AND ra.landlord_user_id = p.user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.viewing_requests vr
      WHERE (vr.landlord_user_id = auth.uid() AND vr.tenant_user_id = p.user_id)
         OR (vr.tenant_user_id   = auth.uid() AND vr.landlord_user_id = p.user_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.marketplace_messages m
      WHERE (m.sender_user_id   = auth.uid() AND m.receiver_user_id = p.user_id)
         OR (m.receiver_user_id = auth.uid() AND m.sender_user_id   = p.user_id)
    )
  );

REVOKE ALL ON public.profiles_counterparty FROM PUBLIC, anon;
GRANT SELECT ON public.profiles_counterparty TO authenticated;

DROP POLICY IF EXISTS "Student reads own application" ON public.rentcare_applications;

CREATE POLICY "Student or admin reads application"
  ON public.rentcare_applications
  FOR SELECT
  TO authenticated
  USING (
    applicant_user_id = auth.uid()
    OR public.is_main_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE OR REPLACE VIEW public.rentcare_applications_nugs
WITH (security_invoker = false, security_barrier = true) AS
SELECT
  id, applicant_user_id, reference, status, payment_status,
  full_name, institution, campus, student_id_code, programme, level,
  accommodation_type, provider_name, accommodation_location,
  amount_requested, total_fee, amount_paid, outstanding_amount,
  region, urgency, deadline,
  created_at, submitted_at, updated_at
FROM public.rentcare_applications
WHERE public.is_nugs_user(auth.uid());

REVOKE ALL ON public.rentcare_applications_nugs FROM PUBLIC, anon;
GRANT SELECT ON public.rentcare_applications_nugs TO authenticated;

ALTER TABLE public.otp_verifications
  ADD COLUMN IF NOT EXISTS code_hash text;

ALTER TABLE public.otp_verifications
  ALTER COLUMN code DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_otp_phone_active
  ON public.otp_verifications (phone, expires_at)
  WHERE verified = false;
