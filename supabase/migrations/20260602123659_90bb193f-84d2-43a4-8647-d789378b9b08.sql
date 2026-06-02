CREATE POLICY "Admin staff can view application evidence"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'application-evidence'
  AND EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid())
);