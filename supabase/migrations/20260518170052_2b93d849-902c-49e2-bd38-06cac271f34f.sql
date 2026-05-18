ALTER TABLE public.form_submissions ALTER COLUMN template_id DROP NOT NULL;
ALTER TABLE public.form_submissions DROP CONSTRAINT IF EXISTS form_submissions_template_id_fkey;
ALTER TABLE public.form_submissions ADD CONSTRAINT form_submissions_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.form_templates(id) ON DELETE SET NULL;