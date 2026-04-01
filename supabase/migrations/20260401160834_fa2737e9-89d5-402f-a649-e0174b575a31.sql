
-- 1. FIX: OTP verifications - remove public read/insert, restrict to service_role
DROP POLICY IF EXISTS "Anon can read otp_verifications" ON public.otp_verifications;
DROP POLICY IF EXISTS "Anon can insert otp_verifications" ON public.otp_verifications;

-- 2. FIX: Property images storage - add ownership checks to DELETE and UPDATE
DROP POLICY IF EXISTS "Users can delete own property images" ON storage.objects;
CREATE POLICY "Users can delete own property images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.landlord_user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

DROP POLICY IF EXISTS "Users can update own property images" ON storage.objects;
CREATE POLICY "Users can update own property images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-images'
  AND EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.landlord_user_id = auth.uid()
      AND (storage.foldername(name))[1] = p.id::text
  )
);

-- 3. FIX: illegal_payment_attempts - restrict INSERT to service_role only
DROP POLICY IF EXISTS "System inserts illegal attempts" ON public.illegal_payment_attempts;
CREATE POLICY "Service role inserts illegal attempts"
ON public.illegal_payment_attempts FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. FIX: admin_staff privilege escalation - restrict INSERT to sub_admin only
DROP POLICY IF EXISTS "Main admins insert admin_staff" ON public.admin_staff;
CREATE POLICY "Main admins insert sub_admin staff"
ON public.admin_staff FOR INSERT
TO authenticated
WITH CHECK (
  is_main_admin(auth.uid())
  AND admin_type != 'main_admin'
);
