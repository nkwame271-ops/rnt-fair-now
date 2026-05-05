
-- Permissions on NUGS staff (default: complaints on, rent_card off)
ALTER TABLE public.nugs_staff
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{"complaints":true,"rent_card":false}'::jsonb;

-- NUGS revenue flag on escrow
ALTER TABLE public.escrow_transactions
  ADD COLUMN IF NOT EXISTS is_nugs_revenue boolean NOT NULL DEFAULT false;

-- Helper: identify NUGS users
CREATE OR REPLACE FUNCTION public.is_nugs_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.nugs_staff WHERE user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.nugs_has_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (permissions ->> _perm)::boolean FROM public.nugs_staff WHERE user_id = _user_id LIMIT 1),
    false
  )
$$;

-- Notes on complaints (shared across NUGS + Rent Control)
CREATE TABLE IF NOT EXISTS public.complaint_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  author_user_id uuid NOT NULL,
  author_role text NOT NULL DEFAULT 'admin',
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'internal',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaint_notes_complaint ON public.complaint_notes(complaint_id, created_at DESC);

ALTER TABLE public.complaint_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read complaint notes" ON public.complaint_notes;
CREATE POLICY "Admins read complaint notes"
ON public.complaint_notes FOR SELECT
USING (
  public.is_main_admin(auth.uid())
  OR public.is_nugs_user(auth.uid())
);

DROP POLICY IF EXISTS "Admins insert complaint notes" ON public.complaint_notes;
CREATE POLICY "Admins insert complaint notes"
ON public.complaint_notes FOR INSERT
WITH CHECK (
  author_user_id = auth.uid()
  AND (
    public.is_main_admin(auth.uid())
    OR public.is_nugs_user(auth.uid())
  )
);

DROP POLICY IF EXISTS "Authors delete own notes" ON public.complaint_notes;
CREATE POLICY "Authors delete own notes"
ON public.complaint_notes FOR DELETE
USING (author_user_id = auth.uid() OR public.is_main_admin(auth.uid()));

-- Audit trail for fee changes during escalation transition
CREATE TABLE IF NOT EXISTS public.complaint_fee_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  old_amount numeric,
  new_amount numeric,
  reason text,
  changed_by uuid,
  scope text NOT NULL DEFAULT 'rent_control',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.complaint_fee_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read fee revisions" ON public.complaint_fee_revisions;
CREATE POLICY "Admins read fee revisions"
ON public.complaint_fee_revisions FOR SELECT
USING (public.is_main_admin(auth.uid()) OR public.is_nugs_user(auth.uid()));

DROP POLICY IF EXISTS "Admins insert fee revisions" ON public.complaint_fee_revisions;
CREATE POLICY "Admins insert fee revisions"
ON public.complaint_fee_revisions FOR INSERT
WITH CHECK (public.is_main_admin(auth.uid()) OR public.is_nugs_user(auth.uid()));
