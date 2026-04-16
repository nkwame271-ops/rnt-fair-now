-- NUGS admin read-only policies (student-scoped)
DROP POLICY IF EXISTS "NUGS admins read student tenants" ON public.tenants;
CREATE POLICY "NUGS admins read student tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'nugs_admin'::app_role) AND is_student = true);

DROP POLICY IF EXISTS "NUGS admins read student complaints" ON public.complaints;
CREATE POLICY "NUGS admins read student complaints"
  ON public.complaints FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.user_id = complaints.tenant_user_id AND t.is_student = true)
  );

DROP POLICY IF EXISTS "NUGS admins read student profiles" ON public.profiles;
CREATE POLICY "NUGS admins read student profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (SELECT 1 FROM public.tenants t WHERE t.user_id = profiles.user_id AND t.is_student = true)
  );

DROP POLICY IF EXISTS "NUGS admins read student complaint schedules" ON public.complaint_schedules;
CREATE POLICY "NUGS admins read student complaint schedules"
  ON public.complaint_schedules FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.complaints c
      JOIN public.tenants t ON t.user_id = c.tenant_user_id
      WHERE c.id = complaint_schedules.complaint_id AND t.is_student = true
    )
  );