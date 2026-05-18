-- Add rich-HTML body to form_templates and link complaint_documents to their template origin
ALTER TABLE public.form_templates
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS category text;

ALTER TABLE public.complaint_documents
  ADD COLUMN IF NOT EXISTS template_origin_id uuid REFERENCES public.form_templates(id) ON DELETE SET NULL;

-- Relax the form_type CHECK constraint so any template form_type can be used
ALTER TABLE public.complaint_documents
  DROP CONSTRAINT IF EXISTS complaint_documents_form_type_check;
-- New: only require non-empty
ALTER TABLE public.complaint_documents
  ADD CONSTRAINT complaint_documents_form_type_nonempty CHECK (form_type IS NOT NULL AND length(form_type) > 0);

CREATE INDEX IF NOT EXISTS idx_complaint_documents_template_origin ON public.complaint_documents(template_origin_id);