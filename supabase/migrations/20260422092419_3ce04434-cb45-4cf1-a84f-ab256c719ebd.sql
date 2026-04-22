CREATE TABLE public.complaint_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL,
  complaint_table text NOT NULL CHECK (complaint_table IN ('complaints','landlord_complaints')),
  assigned_to uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  unassigned_at timestamptz,
  reason text
);

CREATE UNIQUE INDEX complaint_assignments_one_active
  ON public.complaint_assignments (complaint_id, complaint_table)
  WHERE unassigned_at IS NULL;

CREATE INDEX idx_complaint_assignments_assigned_to ON public.complaint_assignments (assigned_to) WHERE unassigned_at IS NULL;
CREATE INDEX idx_complaint_assignments_complaint ON public.complaint_assignments (complaint_id, complaint_table);

ALTER TABLE public.complaint_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read all assignments"
  ON public.complaint_assignments FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Assigned staff read own assignments"
  ON public.complaint_assignments FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "Main admins insert assignments"
  ON public.complaint_assignments FOR INSERT
  TO authenticated
  WITH CHECK (is_main_admin(auth.uid()));

CREATE POLICY "Main admins update assignments"
  ON public.complaint_assignments FOR UPDATE
  TO authenticated
  USING (is_main_admin(auth.uid()));