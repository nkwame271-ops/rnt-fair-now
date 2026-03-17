ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS evidence_urls text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS audio_url text;