
-- Add RLS policies for the identity-documents storage bucket
CREATE POLICY "Users can upload own identity docs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'identity-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own identity docs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'identity-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own identity docs"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'identity-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
