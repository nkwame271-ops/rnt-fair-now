
-- Add property_category to properties
ALTER TABLE public.properties ADD COLUMN property_category text NOT NULL DEFAULT 'residential';

-- Create landlord_applications table
CREATE TABLE public.landlord_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL,
  application_type text NOT NULL,
  subject text NOT NULL,
  description text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  audio_url text,
  status text NOT NULL DEFAULT 'pending',
  reviewer_user_id uuid,
  reviewer_notes text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage own applications" ON public.landlord_applications FOR ALL TO authenticated
  USING (auth.uid() = landlord_user_id) WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all applications" ON public.landlord_applications FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators update applications" ON public.landlord_applications FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Create landlord_complaints table
CREATE TABLE public.landlord_complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL,
  complaint_code text NOT NULL,
  complaint_type text NOT NULL,
  tenant_name text,
  property_address text NOT NULL,
  region text NOT NULL,
  description text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_complaints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage own complaints" ON public.landlord_complaints FOR ALL TO authenticated
  USING (auth.uid() = landlord_user_id) WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all landlord complaints" ON public.landlord_complaints FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators update landlord complaints" ON public.landlord_complaints FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

-- Create application-evidence storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('application-evidence', 'application-evidence', true);

-- RLS for application-evidence bucket
CREATE POLICY "Authenticated users upload evidence" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'application-evidence');

CREATE POLICY "Anyone can view evidence" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'application-evidence');

CREATE POLICY "Users delete own evidence" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'application-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
