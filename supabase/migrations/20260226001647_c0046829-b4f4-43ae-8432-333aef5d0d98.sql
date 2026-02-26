
-- Create KYC verifications table
CREATE TABLE public.kyc_verifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ghana_card_number TEXT NOT NULL,
  ghana_card_front_url TEXT,
  ghana_card_back_url TEXT,
  selfie_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_match_score NUMERIC,
  ai_match_result TEXT,
  reviewer_user_id UUID,
  reviewer_notes TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Users can read own KYC record
CREATE POLICY "Users can read own kyc" ON public.kyc_verifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert own KYC record
CREATE POLICY "Users can insert own kyc" ON public.kyc_verifications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update own kyc (only while pending)
CREATE POLICY "Users can update own pending kyc" ON public.kyc_verifications
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Regulators can read all KYC records
CREATE POLICY "Regulators can read all kyc" ON public.kyc_verifications
  FOR SELECT USING (public.has_role(auth.uid(), 'regulator'));

-- Regulators can update KYC records (approve/reject)
CREATE POLICY "Regulators can update kyc" ON public.kyc_verifications
  FOR UPDATE USING (public.has_role(auth.uid(), 'regulator'));

-- Trigger for updated_at
CREATE TRIGGER update_kyc_updated_at
  BEFORE UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for identity documents
INSERT INTO storage.buckets (id, name, public) VALUES ('identity-documents', 'identity-documents', false);

-- Users can upload to their own folder
CREATE POLICY "Users upload own identity docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'identity-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can view own identity docs
CREATE POLICY "Users view own identity docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'identity-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Regulators can view all identity docs
CREATE POLICY "Regulators view all identity docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'identity-documents' AND public.has_role(auth.uid(), 'regulator'));
