
ALTER TABLE public.complaint_documents
  ADD COLUMN IF NOT EXISTS verification_code text UNIQUE;

-- Backfill existing rows
UPDATE public.complaint_documents
SET verification_code = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE verification_code IS NULL;

-- Trigger to auto-set on insert
CREATE OR REPLACE FUNCTION public.set_complaint_document_verification_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.verification_code IS NULL OR NEW.verification_code = '' THEN
    NEW.verification_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_complaint_document_verification_code ON public.complaint_documents;
CREATE TRIGGER trg_set_complaint_document_verification_code
BEFORE INSERT ON public.complaint_documents
FOR EACH ROW
EXECUTE FUNCTION public.set_complaint_document_verification_code();
