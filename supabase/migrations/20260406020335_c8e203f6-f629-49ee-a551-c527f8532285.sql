
-- 1. Region Codes table
CREATE TABLE public.region_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL UNIQUE,
  code text NOT NULL UNIQUE,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.region_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read region_codes" ON public.region_codes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Regulators manage region_codes" ON public.region_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

-- 2. Generation Batches table
CREATE TABLE public.generation_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_label text NOT NULL,
  prefix text NOT NULL,
  regions text[] NOT NULL DEFAULT '{}',
  region_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_unique_serials integer NOT NULL DEFAULT 0,
  total_physical_cards integer NOT NULL DEFAULT 0,
  paired_mode boolean DEFAULT true,
  generated_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.generation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read generation_batches" ON public.generation_batches
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages generation_batches" ON public.generation_batches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. Office Allocations table
CREATE TABLE public.office_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  region text NOT NULL,
  office_id text NOT NULL,
  office_name text NOT NULL,
  quantity integer NOT NULL,
  allocation_mode text NOT NULL DEFAULT 'transfer',
  quota_limit integer,
  start_serial text,
  end_serial text,
  serial_numbers text[] NOT NULL DEFAULT '{}',
  allocated_by uuid NOT NULL,
  batch_label text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.office_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read office_allocations" ON public.office_allocations
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages office_allocations" ON public.office_allocations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. Add stock_type and office_allocation_id to rent_card_serial_stock
ALTER TABLE public.rent_card_serial_stock
  ADD COLUMN IF NOT EXISTS stock_type text NOT NULL DEFAULT 'regional',
  ADD COLUMN IF NOT EXISTS office_allocation_id uuid;

-- 5. Seed default region codes
INSERT INTO public.region_codes (region, code) VALUES
  ('Greater Accra', 'GAR'),
  ('Ashanti', 'ASH'),
  ('Western', 'WR'),
  ('Central', 'CR'),
  ('Eastern', 'ER'),
  ('Volta', 'VR'),
  ('Northern', 'NR'),
  ('Upper East', 'UER'),
  ('Upper West', 'UWR'),
  ('Bono', 'BR'),
  ('Bono East', 'BER'),
  ('Ahafo', 'AHR'),
  ('Western North', 'WNR'),
  ('Oti', 'OR'),
  ('Savannah', 'SVR'),
  ('North East', 'NER')
ON CONFLICT (region) DO NOTHING;
