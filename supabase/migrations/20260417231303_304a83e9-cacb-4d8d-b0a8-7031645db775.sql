
-- 1. Table
CREATE TABLE IF NOT EXISTS public.student_residence_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_user_id uuid NOT NULL,
  school text,
  hostel_or_hall text,
  room_or_bed_space text,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  change_reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_residence_history_tenant
  ON public.student_residence_history(tenant_user_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS idx_student_residence_history_open
  ON public.student_residence_history(tenant_user_id)
  WHERE effective_to IS NULL;

ALTER TABLE public.student_residence_history ENABLE ROW LEVEL SECURITY;

-- 2. RLS
DROP POLICY IF EXISTS "Students view own residence history" ON public.student_residence_history;
CREATE POLICY "Students view own residence history"
ON public.student_residence_history
FOR SELECT
TO authenticated
USING (tenant_user_id = auth.uid());

DROP POLICY IF EXISTS "Students insert own residence history" ON public.student_residence_history;
CREATE POLICY "Students insert own residence history"
ON public.student_residence_history
FOR INSERT
TO authenticated
WITH CHECK (tenant_user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all residence history" ON public.student_residence_history;
CREATE POLICY "Admins view all residence history"
ON public.student_residence_history
FOR SELECT
TO authenticated
USING (
  public.is_main_admin(auth.uid())
  OR public.has_role(auth.uid(), 'regulator'::app_role)
  OR public.has_role(auth.uid(), 'nugs_admin'::app_role)
);

-- 3. Trigger: snapshot residence changes on tenants table
CREATE OR REPLACE FUNCTION public.snapshot_student_residence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_student IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  -- Only act when a residence field actually changed
  IF TG_OP = 'UPDATE' AND
     COALESCE(NEW.school, '') = COALESCE(OLD.school, '') AND
     COALESCE(NEW.hostel_or_hall, '') = COALESCE(OLD.hostel_or_hall, '') AND
     COALESCE(NEW.room_or_bed_space, '') = COALESCE(OLD.room_or_bed_space, '') THEN
    RETURN NEW;
  END IF;

  -- Close any currently-open history row
  UPDATE public.student_residence_history
  SET effective_to = now()
  WHERE tenant_user_id = NEW.user_id
    AND effective_to IS NULL;

  -- Insert the new open snapshot
  INSERT INTO public.student_residence_history (
    tenant_user_id, school, hostel_or_hall, room_or_bed_space, changed_by
  ) VALUES (
    NEW.user_id, NEW.school, NEW.hostel_or_hall, NEW.room_or_bed_space, auth.uid()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_student_residence ON public.tenants;
CREATE TRIGGER trg_snapshot_student_residence
AFTER INSERT OR UPDATE OF school, hostel_or_hall, room_or_bed_space, is_student
ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_student_residence();

-- 4. Backfill: one open row per existing student
INSERT INTO public.student_residence_history (
  tenant_user_id, school, hostel_or_hall, room_or_bed_space, effective_from, change_reason
)
SELECT t.user_id, t.school, t.hostel_or_hall, t.room_or_bed_space, COALESCE(t.created_at, now()), 'backfill'
FROM public.tenants t
WHERE t.is_student = true
  AND NOT EXISTS (
    SELECT 1 FROM public.student_residence_history h
    WHERE h.tenant_user_id = t.user_id
  );
