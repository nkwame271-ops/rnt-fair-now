
-- Create rent_bands table
CREATE TABLE public.rent_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_rent numeric NOT NULL DEFAULT 0,
  max_rent numeric,
  fee_amount numeric NOT NULL DEFAULT 30,
  label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.rent_bands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read rent bands" ON public.rent_bands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Regulators manage rent bands" ON public.rent_bands FOR ALL TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role)) WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Service role manages rent bands" ON public.rent_bands FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default rent bands
INSERT INTO public.rent_bands (min_rent, max_rent, fee_amount, label) VALUES
  (0, 500, 30, 'Up to GH₵ 500'),
  (500.01, 1000, 50, 'GH₵ 500 - 1,000'),
  (1000.01, 2000, 80, 'GH₵ 1,000 - 2,000'),
  (2000.01, NULL, 120, 'Above GH₵ 2,000');

-- Create pending_tenants table
CREATE TABLE public.pending_tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  created_by uuid NOT NULL,
  tenancy_id uuid,
  claimed_by uuid,
  claimed_at timestamptz,
  sms_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords read own pending tenants" ON public.pending_tenants FOR SELECT TO authenticated USING (auth.uid() = created_by);
CREATE POLICY "Landlords insert pending tenants" ON public.pending_tenants FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Regulators manage pending tenants" ON public.pending_tenants FOR ALL TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role)) WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Service role manages pending tenants" ON public.pending_tenants FOR ALL TO service_role USING (true) WITH CHECK (true);
