CREATE TABLE public.contact_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert contact submissions"
ON public.contact_submissions
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Regulators can read all contact submissions"
ON public.contact_submissions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators can update contact submissions"
ON public.contact_submissions
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));