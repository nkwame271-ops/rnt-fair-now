-- Admin staff can read every complaint (their dashboards already filter by office)
CREATE POLICY "Admin staff read complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_staff
      WHERE admin_staff.user_id = auth.uid()
    )
  );

-- Admin staff can delete complaint documents (e.g. regenerated drafts)
CREATE POLICY "Admin delete complaint documents"
  ON public.complaint_documents
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_staff
      WHERE admin_staff.user_id = auth.uid()
    )
  );

-- Allow main admins / super admins to delete form templates
CREATE POLICY "Main admins delete form templates"
  ON public.form_templates
  FOR DELETE
  TO authenticated
  USING (public.is_main_admin(auth.uid()));
