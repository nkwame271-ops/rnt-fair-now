
CREATE POLICY "Main admins can read data exports"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'data-exports' AND public.is_main_admin(auth.uid()));

CREATE POLICY "Main admins can delete data exports"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'data-exports' AND public.is_main_admin(auth.uid()));
