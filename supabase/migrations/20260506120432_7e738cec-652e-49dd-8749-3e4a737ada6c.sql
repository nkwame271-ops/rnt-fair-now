
-- Add NUGS school selection on complaints and update RLS to allow NUGS admins to see complaints they own by either the explicit complaints.nugs_school OR the legacy tenants.school match.
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS nugs_school text;

CREATE INDEX IF NOT EXISTS idx_complaints_nugs_school
  ON public.complaints (lower(nugs_school));

DROP POLICY IF EXISTS "NUGS admins read student complaints" ON public.complaints;
CREATE POLICY "NUGS admins read student complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.nugs_staff ns
      WHERE ns.user_id = auth.uid()
        AND (
          (complaints.nugs_school IS NOT NULL
            AND lower(trim(complaints.nugs_school)) = lower(trim(ns.assigned_school)))
          OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.user_id = complaints.tenant_user_id
              AND t.is_student = true
              AND t.school IS NOT NULL
              AND lower(trim(t.school)) = lower(trim(ns.assigned_school))
          )
        )
    )
  );

DROP POLICY IF EXISTS "NUGS admins update student complaints" ON public.complaints;
CREATE POLICY "NUGS admins update student complaints"
  ON public.complaints
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.nugs_staff ns
      WHERE ns.user_id = auth.uid()
        AND (
          (complaints.nugs_school IS NOT NULL
            AND lower(trim(complaints.nugs_school)) = lower(trim(ns.assigned_school)))
          OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.user_id = complaints.tenant_user_id
              AND t.is_student = true
              AND lower(trim(t.school)) = lower(trim(ns.assigned_school))
          )
        )
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.nugs_staff ns
      WHERE ns.user_id = auth.uid()
        AND (
          (complaints.nugs_school IS NOT NULL
            AND lower(trim(complaints.nugs_school)) = lower(trim(ns.assigned_school)))
          OR EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.user_id = complaints.tenant_user_id
              AND t.is_student = true
              AND lower(trim(t.school)) = lower(trim(ns.assigned_school))
          )
        )
    )
  );
