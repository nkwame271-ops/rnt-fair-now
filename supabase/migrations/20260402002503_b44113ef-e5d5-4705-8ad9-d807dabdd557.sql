
-- Create rent_band_allocations table
CREATE TABLE public.rent_band_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_band_id uuid NOT NULL REFERENCES public.rent_bands(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'agreement_sale',
  recipient text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(rent_band_id, payment_type, recipient)
);

ALTER TABLE public.rent_band_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage band allocations" ON public.rent_band_allocations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'regulator'::public.app_role));

CREATE POLICY "Service role manages band allocations" ON public.rent_band_allocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read band allocations" ON public.rent_band_allocations
  FOR SELECT TO authenticated USING (true);

-- Seed default allocations for each rent band
-- For agreement_sale: current split_configurations show rent_control=10, admin=20 (total=30)
-- For add_tenant_fee: current split_configurations show rent_control=1.5, admin=1.5, platform=1 (total=4)
-- We proportionally scale these to each band's fee_amount

-- agreement_sale allocations (rent_control 33.3%, admin 66.7%)
INSERT INTO public.rent_band_allocations (rent_band_id, payment_type, recipient, amount, description, sort_order)
SELECT rb.id, 'agreement_sale', 'rent_control', ROUND(rb.fee_amount * 10.0 / 30.0, 2), 'IGF - Agreement Sale', 0
FROM public.rent_bands rb;

INSERT INTO public.rent_band_allocations (rent_band_id, payment_type, recipient, amount, description, sort_order)
SELECT rb.id, 'agreement_sale', 'admin', ROUND(rb.fee_amount * 20.0 / 30.0, 2), 'Admin - Agreement Sale', 1
FROM public.rent_bands rb;

-- add_tenant_fee allocations (rent_control 37.5%, admin 37.5%, platform 25%)
INSERT INTO public.rent_band_allocations (rent_band_id, payment_type, recipient, amount, description, sort_order)
SELECT rb.id, 'add_tenant_fee', 'rent_control', ROUND(rb.fee_amount * 1.5 / 4.0, 2), 'IGF - Add Tenant', 0
FROM public.rent_bands rb;

INSERT INTO public.rent_band_allocations (rent_band_id, payment_type, recipient, amount, description, sort_order)
SELECT rb.id, 'add_tenant_fee', 'admin', ROUND(rb.fee_amount * 1.5 / 4.0, 2), 'Admin - Add Tenant', 1
FROM public.rent_bands rb;

INSERT INTO public.rent_band_allocations (rent_band_id, payment_type, recipient, amount, description, sort_order)
SELECT rb.id, 'add_tenant_fee', 'platform', ROUND(rb.fee_amount * 1.0 / 4.0, 2), 'Platform - Add Tenant', 2
FROM public.rent_bands rb;
