
-- 1. Restrict agreement PDFs in application-evidence bucket to authenticated users only
DROP POLICY IF EXISTS "Public can view agreement PDFs" ON storage.objects;

CREATE POLICY "Authenticated users can view agreement PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND (storage.foldername(name))[1] = ANY (ARRAY[
    'agreements','signed-agreements','existing-agreements',
    'generated-agreements','final-agreements'
  ])
);

-- 2. Tighten property-images upload policy: require ownership of the property folder
DROP POLICY IF EXISTS "Authenticated users can upload property images" ON storage.objects;

CREATE POLICY "Owners can upload property images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.landlord_user_id = auth.uid()
      AND (storage.foldername(objects.name))[1] = (p.id)::text
  )
);

-- 3. Scope complaint_witnesses SELECT to assigned officers / privileged admins only
DROP POLICY IF EXISTS "Admin staff read witnesses" ON public.complaint_witnesses;

CREATE POLICY "Assigned officers and privileged admins read witnesses"
ON public.complaint_witnesses FOR SELECT
TO authenticated
USING (
  is_main_admin(auth.uid())
  OR is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'regulator'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.complaints c
    WHERE c.id = complaint_witnesses.case_id
      AND c.assigned_officer_user_id = auth.uid()
  )
);

-- 4. Restrict kyc_verifications full read to main/super admins (regulators no longer get bulk PII)
DROP POLICY IF EXISTS "Regulators can read all kyc" ON public.kyc_verifications;

CREATE POLICY "Privileged admins read all kyc"
ON public.kyc_verifications FOR SELECT
TO authenticated
USING (is_main_admin(auth.uid()) OR is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Regulators can update kyc" ON public.kyc_verifications;

CREATE POLICY "Privileged admins update kyc"
ON public.kyc_verifications FOR UPDATE
TO authenticated
USING (is_main_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 5. Restrict profiles full read to main/super admins (regulators must use profiles_counterparty)
DROP POLICY IF EXISTS "Regulators can read all profiles" ON public.profiles;

CREATE POLICY "Privileged admins read all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (is_main_admin(auth.uid()) OR is_super_admin(auth.uid()));

-- 6. Strip raw provider_payload from authenticated users on payment_intents
REVOKE SELECT (provider_payload) ON public.payment_intents FROM authenticated;
