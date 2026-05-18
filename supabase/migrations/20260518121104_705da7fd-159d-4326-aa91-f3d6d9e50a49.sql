ALTER TABLE public.complaint_documents
  ADD COLUMN IF NOT EXISTS form_data_json jsonb;

DO $$
DECLARE
  c text;
BEGIN
  SELECT conname INTO c
  FROM pg_constraint
  WHERE conrelid = 'public.complaint_documents'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%form_type%';
  IF c IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.complaint_documents DROP CONSTRAINT %I', c);
  END IF;
END $$;

ALTER TABLE public.complaint_documents
  ADD CONSTRAINT complaint_documents_form_type_check
  CHECK (form_type IN ('form_7','form_33','form_32a','summons','complaint_profile','ruling','notice','other'));