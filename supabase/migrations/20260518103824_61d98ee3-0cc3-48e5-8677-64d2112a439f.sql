ALTER TABLE public.complaint_documents 
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS body_html text,
  ADD COLUMN IF NOT EXISTS body_json jsonb;