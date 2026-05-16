
-- 1. Extend complaints for admin-filed cases
ALTER TABLE public.complaints
  ALTER COLUMN tenant_user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS filed_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_filer_user_id uuid,
  ADD COLUMN IF NOT EXISTS complainant_role text,
  ADD COLUMN IF NOT EXISTS respondent_role text,
  ADD COLUMN IF NOT EXISTS respondent_user_id uuid,
  ADD COLUMN IF NOT EXISTS placeholder_complainant_name text,
  ADD COLUMN IF NOT EXISTS placeholder_complainant_phone text,
  ADD COLUMN IF NOT EXISTS placeholder_respondent_name text,
  ADD COLUMN IF NOT EXISTS placeholder_respondent_phone text,
  ADD COLUMN IF NOT EXISTS physical_docket_ref text,
  ADD COLUMN IF NOT EXISTS rent_amount numeric,
  ADD COLUMN IF NOT EXISTS linked_unit_id uuid;

CREATE INDEX IF NOT EXISTS idx_complaints_filed_by_admin ON public.complaints(filed_by_admin) WHERE filed_by_admin = true;
CREATE INDEX IF NOT EXISTS idx_complaints_docket ON public.complaints(physical_docket_ref) WHERE physical_docket_ref IS NOT NULL;

-- 2. Form Templates
CREATE TABLE IF NOT EXISTS public.form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_name text NOT NULL,
  form_number text,
  regulation_ref text,
  department text,
  version text NOT NULL DEFAULT '1.0',
  effective_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','retired')),
  schema jsonb NOT NULL DEFAULT '{"sections":[]}'::jsonb,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin staff read templates" ON public.form_templates
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid()));

CREATE POLICY "Main admins manage templates" ON public.form_templates
  FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TRIGGER form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Form Submissions
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE RESTRICT,
  complaint_id uuid REFERENCES public.complaints(id) ON DELETE SET NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized')),
  pdf_url text,
  generated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_submissions_template ON public.form_submissions(template_id);
CREATE INDEX IF NOT EXISTS idx_form_submissions_complaint ON public.form_submissions(complaint_id);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin staff manage submissions" ON public.form_submissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid()));

CREATE POLICY "Complainant reads own submissions" ON public.form_submissions
  FOR SELECT TO authenticated
  USING (
    complaint_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM complaints c WHERE c.id = complaint_id AND c.tenant_user_id = auth.uid())
  );

CREATE TRIGGER form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Storage bucket for generated form PDFs
INSERT INTO storage.buckets (id, name, public)
  VALUES ('form-outputs', 'form-outputs', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin staff read form outputs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'form-outputs'
    AND EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin staff upload form outputs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'form-outputs'
    AND EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin staff update form outputs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'form-outputs'
    AND EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid())
  );

CREATE POLICY "Admin staff delete form outputs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'form-outputs'
    AND EXISTS (SELECT 1 FROM admin_staff WHERE user_id = auth.uid())
  );
