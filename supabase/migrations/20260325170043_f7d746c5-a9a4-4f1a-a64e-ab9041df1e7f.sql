
-- Migration 1: Create offices table and cases table

CREATE TABLE public.offices (
  id text PRIMARY KEY,
  name text NOT NULL,
  region text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read offices" ON public.offices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can read offices" ON public.offices FOR SELECT TO anon USING (true);
CREATE POLICY "Service role manages offices" ON public.offices FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Populate from GHANA_OFFICES
INSERT INTO public.offices (id, name, region) VALUES
  ('accra_central', 'Accra Central Office', 'Greater Accra'),
  ('accra_north', 'Accra North Office', 'Greater Accra'),
  ('tema', 'Tema Office', 'Greater Accra'),
  ('kumasi', 'Kumasi Office', 'Ashanti'),
  ('kumasi_south', 'Kumasi South Office', 'Ashanti'),
  ('takoradi', 'Takoradi Office', 'Western'),
  ('cape_coast', 'Cape Coast Office', 'Central'),
  ('tamale', 'Tamale Office', 'Northern'),
  ('sunyani', 'Sunyani Office', 'Bono'),
  ('ho', 'Ho Office', 'Volta'),
  ('koforidua', 'Koforidua Office', 'Eastern'),
  ('bolgatanga', 'Bolgatanga Office', 'Upper East'),
  ('wa', 'Wa Office', 'Upper West'),
  ('techiman', 'Techiman Office', 'Bono East'),
  ('goaso', 'Goaso Office', 'Ahafo'),
  ('damongo', 'Damongo Office', 'Savannah'),
  ('nalerigu', 'Nalerigu Office', 'North East'),
  ('dambai', 'Dambai Office', 'Oti'),
  ('sefwi_wiawso', 'Sefwi Wiawso Office', 'Western North'),
  ('tarkwa', 'Tarkwa Office', 'Western'),
  ('obuasi', 'Obuasi Office', 'Ashanti'),
  ('nkawkaw', 'Nkawkaw Office', 'Eastern'),
  ('winneba', 'Winneba Office', 'Central'),
  ('kasoa', 'Kasoa Office', 'Central'),
  ('madina', 'Madina Office', 'Greater Accra'),
  ('ashaiman', 'Ashaiman Office', 'Greater Accra'),
  ('teshie_nungua', 'Teshie-Nungua Office', 'Greater Accra'),
  ('dansoman', 'Dansoman Office', 'Greater Accra'),
  ('kaneshie', 'Kaneshie Office', 'Greater Accra'),
  ('achimota', 'Achimota Office', 'Greater Accra'),
  ('adenta', 'Adenta Office', 'Greater Accra'),
  ('dome', 'Dome Office', 'Greater Accra'),
  ('lapaz', 'Lapaz Office', 'Greater Accra'),
  ('spintex', 'Spintex Office', 'Greater Accra'),
  ('east_legon', 'East Legon Office', 'Greater Accra'),
  ('airport_area', 'Airport Area Office', 'Greater Accra'),
  ('osu', 'Osu Office', 'Greater Accra'),
  ('la', 'La Office', 'Greater Accra'),
  ('cantonment', 'Cantonment Office', 'Greater Accra'),
  ('dzorwulu', 'Dzorwulu Office', 'Greater Accra'),
  ('roman_ridge', 'Roman Ridge Office', 'Greater Accra'),
  ('weija', 'Weija Office', 'Greater Accra'),
  ('awoshie', 'Awoshie Office', 'Greater Accra'),
  ('ablekuma', 'Ablekuma Office', 'Greater Accra'),
  ('amasaman', 'Amasaman Office', 'Greater Accra'),
  ('nsawam', 'Nsawam Office', 'Eastern'),
  ('suhum', 'Suhum Office', 'Eastern'),
  ('oda', 'Oda Office', 'Eastern'),
  ('akim_oda', 'Akim Oda Office', 'Eastern'),
  ('swedru', 'Swedru Office', 'Central'),
  ('mankessim', 'Mankessim Office', 'Central'),
  ('elmina', 'Elmina Office', 'Central'),
  ('saltpond', 'Saltpond Office', 'Central'),
  ('keta', 'Keta Office', 'Volta'),
  ('hohoe', 'Hohoe Office', 'Volta'),
  ('kpando', 'Kpando Office', 'Volta'),
  ('nkwanta', 'Nkwanta Office', 'Oti'),
  ('bawku', 'Bawku Office', 'Upper East'),
  ('navrongo', 'Navrongo Office', 'Upper East'),
  ('yendi', 'Yendi Office', 'Northern'),
  ('bimbilla', 'Bimbilla Office', 'Northern'),
  ('salaga', 'Salaga Office', 'Savannah'),
  ('kintampo', 'Kintampo Office', 'Bono East'),
  ('berekum', 'Berekum Office', 'Bono'),
  ('dormaa', 'Dormaa Office', 'Bono'),
  ('bibiani', 'Bibiani Office', 'Western North');

-- Cases table
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL UNIQUE,
  office_id text NOT NULL REFERENCES public.offices(id),
  user_id uuid NOT NULL,
  case_type text NOT NULL,
  related_property_id uuid,
  related_tenancy_id uuid,
  related_complaint_id uuid,
  status text NOT NULL DEFAULT 'open',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cases" ON public.cases FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Regulators read all cases" ON public.cases FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));
CREATE POLICY "Users insert own cases" ON public.cases FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role manages cases" ON public.cases FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add office_id and case_id to existing tables
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS office_id text REFERENCES public.offices(id);
ALTER TABLE public.escrow_transactions ADD COLUMN IF NOT EXISTS case_id uuid;
ALTER TABLE public.escrow_splits ADD COLUMN IF NOT EXISTS office_id text;
ALTER TABLE public.payment_receipts ADD COLUMN IF NOT EXISTS office_id text;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS office_id text;
ALTER TABLE public.landlord_complaints ADD COLUMN IF NOT EXISTS office_id text;
ALTER TABLE public.tenancies ADD COLUMN IF NOT EXISTS office_id text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS office_id text;

-- Case number sequence + functions
CREATE SEQUENCE IF NOT EXISTS case_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_case_number()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN 'CASE-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('case_number_seq')::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_office_id(p_region text, p_area text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  resolved text;
BEGIN
  IF p_area IS NOT NULL THEN
    SELECT id INTO resolved FROM offices
    WHERE lower(replace(name, ' Office', '')) = lower(p_area)
    LIMIT 1;
    IF resolved IS NOT NULL THEN RETURN resolved; END IF;
  END IF;
  SELECT id INTO resolved FROM offices
  WHERE lower(region) = lower(p_region)
  LIMIT 1;
  RETURN COALESCE(resolved, 'accra_central');
END;
$$;
