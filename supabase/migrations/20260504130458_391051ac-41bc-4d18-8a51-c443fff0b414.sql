
-- 1. NUGS staff assignment table (one school per NUGS admin)
CREATE TABLE IF NOT EXISTS public.nugs_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  assigned_school text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nugs_staff_school ON public.nugs_staff (assigned_school);

ALTER TABLE public.nugs_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins manage nugs_staff" ON public.nugs_staff;
CREATE POLICY "Super admins manage nugs_staff"
  ON public.nugs_staff
  FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "NUGS admin reads own assignment" ON public.nugs_staff;
CREATE POLICY "NUGS admin reads own assignment"
  ON public.nugs_staff
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Regulators read nugs_staff" ON public.nugs_staff;
CREATE POLICY "Regulators read nugs_staff"
  ON public.nugs_staff
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'::app_role));

DROP POLICY IF EXISTS "Service role manages nugs_staff" ON public.nugs_staff;
CREATE POLICY "Service role manages nugs_staff"
  ON public.nugs_staff
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER nugs_staff_updated_at
  BEFORE UPDATE ON public.nugs_staff
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Escalation fields on complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS escalated_to_rent_control boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_by uuid,
  ADD COLUMN IF NOT EXISTS escalation_reason text;

CREATE INDEX IF NOT EXISTS idx_complaints_escalated
  ON public.complaints (escalated_to_rent_control)
  WHERE escalated_to_rent_control = true;

-- 3. Update NUGS admin RLS on complaints to scope by assigned school
DROP POLICY IF EXISTS "NUGS admins read student complaints" ON public.complaints;
CREATE POLICY "NUGS admins read student complaints"
  ON public.complaints
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.tenants t
      JOIN public.nugs_staff ns ON ns.user_id = auth.uid()
      WHERE t.user_id = complaints.tenant_user_id
        AND t.is_student = true
        AND t.school IS NOT NULL
        AND lower(trim(t.school)) = lower(trim(ns.assigned_school))
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
      FROM public.tenants t
      JOIN public.nugs_staff ns ON ns.user_id = auth.uid()
      WHERE t.user_id = complaints.tenant_user_id
        AND t.is_student = true
        AND lower(trim(t.school)) = lower(trim(ns.assigned_school))
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'nugs_admin'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.tenants t
      JOIN public.nugs_staff ns ON ns.user_id = auth.uid()
      WHERE t.user_id = complaints.tenant_user_id
        AND t.is_student = true
        AND lower(trim(t.school)) = lower(trim(ns.assigned_school))
    )
  );
