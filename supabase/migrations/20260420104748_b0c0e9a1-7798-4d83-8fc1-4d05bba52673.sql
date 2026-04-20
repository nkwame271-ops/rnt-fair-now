-- Make application-evidence bucket PRIVATE
UPDATE storage.buckets SET public = false WHERE id = 'application-evidence';

-- Drop the overly-permissive "Anyone can view" policy
DROP POLICY IF EXISTS "Anyone can view evidence" ON storage.objects;

-- Drop existing upload/delete policies so we can recreate cleanly
DROP POLICY IF EXISTS "Authenticated users upload evidence" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own evidence" ON storage.objects;

-- =====================================================
-- READ policies for application-evidence bucket
-- =====================================================

-- 1. Public read on agreement PDFs only (required by /verify-tenancy QR flow)
--    These are signed legal documents already meant for public verification.
CREATE POLICY "Public can view agreement PDFs"
ON storage.objects FOR SELECT
TO public
USING (
  bucket_id = 'application-evidence'
  AND (
    (storage.foldername(name))[1] = 'agreements'
    OR (storage.foldername(name))[1] = 'signed-agreements'
    OR (storage.foldername(name))[1] = 'existing-agreements'
    OR (storage.foldername(name))[1] = 'generated-agreements'
    OR (storage.foldername(name))[1] = 'final-agreements'
  )
);

-- 2. Authenticated users can read files they uploaded
--    Two patterns are used in the codebase:
--      a) <user_id>/<file>                          (landlord complaints/applications)
--      b) <prefix>/<user_id>/<file>                 (rent-increase, existing-voice, etc.)
CREATE POLICY "Users can view their own evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- 3. Regulators (admin staff) can read every file in the bucket
CREATE POLICY "Regulators can view all evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND has_role(auth.uid(), 'regulator'::app_role)
);

-- 4. Tenants & landlords can read evidence attached to complaints/landlord_complaints
--    they are involved in. Path pattern: complaints/<complaint_id>/...
CREATE POLICY "Complaint parties can view complaint evidence"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND (storage.foldername(name))[1] = 'complaints'
  AND (
    EXISTS (
      SELECT 1 FROM public.complaints c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND c.tenant_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.landlord_complaints lc
      WHERE lc.id::text = (storage.foldername(name))[2]
        AND lc.landlord_user_id = auth.uid()
    )
  )
);

-- =====================================================
-- WRITE policies (recreate)
-- =====================================================

-- Authenticated users may upload to the bucket
CREATE POLICY "Authenticated users can upload evidence"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'application-evidence');

-- Authenticated users may upsert their own files
CREATE POLICY "Users can update their own evidence"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Users can delete files in their own folder
CREATE POLICY "Users can delete their own evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR (storage.foldername(name))[2] = auth.uid()::text
  )
);

-- Regulators can delete any file (for moderation)
CREATE POLICY "Regulators can delete any evidence"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND has_role(auth.uid(), 'regulator'::app_role)
);