
CREATE POLICY "Agent docs public folder insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'agent-documents' AND (storage.foldername(name))[1] = 'public');

CREATE POLICY "Agent docs own folder insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'agent-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Agent docs own or admin read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'agent-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_main_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  );

CREATE POLICY "Agent docs admin manage"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'agent-documents' AND (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid())))
  WITH CHECK (bucket_id = 'agent-documents' AND (public.is_main_admin(auth.uid()) OR public.is_super_admin(auth.uid())));
