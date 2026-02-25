
-- Agreement template configuration table (single-row config)
CREATE TABLE public.agreement_template_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  max_advance_months integer NOT NULL DEFAULT 6,
  min_lease_duration integer NOT NULL DEFAULT 1,
  max_lease_duration integer NOT NULL DEFAULT 24,
  tax_rate numeric NOT NULL DEFAULT 8,
  registration_deadline_days integer NOT NULL DEFAULT 14,
  terms text[] NOT NULL DEFAULT ARRAY[
    'The Tenant shall pay rent monthly, including the statutory 8% government tax through the Rent Control app.',
    'Advance rent shall not exceed 6 months as mandated by Act 220.',
    'This agreement must be registered within 14 days of signing.',
    'The Landlord shall maintain the property in habitable condition.',
    'Neither party may unilaterally vary the terms without due process.',
    'The tenancy is only valid for months where the 8% tax has been paid.'
  ],
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.agreement_template_config ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read (landlords need it for PDF generation)
CREATE POLICY "Authenticated users can read template config"
ON public.agreement_template_config FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Only regulators can update
CREATE POLICY "Regulators can update template config"
ON public.agreement_template_config FOR UPDATE
USING (has_role(auth.uid(), 'regulator'::app_role));

-- Only regulators can insert
CREATE POLICY "Regulators can insert template config"
ON public.agreement_template_config FOR INSERT
WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

-- Seed with default config
INSERT INTO public.agreement_template_config (id) VALUES (gen_random_uuid());
