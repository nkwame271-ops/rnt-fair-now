CREATE TABLE public.system_backup_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_by_email text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
  drive_folder_id text,
  drive_folder_url text,
  drive_folder_name text,
  tables_included jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_rows bigint NOT NULL DEFAULT 0,
  current_table text,
  progress_percent int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.system_backup_log TO authenticated;
GRANT ALL ON public.system_backup_log TO service_role;

ALTER TABLE public.system_backup_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view backup log"
  ON public.system_backup_log FOR SELECT
  TO authenticated
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Super admin can insert backup log"
  ON public.system_backup_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE POLICY "Super admin can update backup log"
  ON public.system_backup_log FOR UPDATE
  TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE INDEX idx_system_backup_log_started_at ON public.system_backup_log (started_at DESC);

CREATE TRIGGER update_system_backup_log_updated_at
  BEFORE UPDATE ON public.system_backup_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();