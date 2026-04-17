-- 1. Extend complaint_types
ALTER TABLE public.complaint_types
  ADD COLUMN IF NOT EXISTS fee_structure text NOT NULL DEFAULT 'fixed' CHECK (fee_structure IN ('fixed','rent_band','percentage')),
  ADD COLUMN IF NOT EXISTS requires_property_link boolean NOT NULL DEFAULT false;

-- Backfill fee_structure from legacy fee_mode
UPDATE public.complaint_types
SET fee_structure = CASE
  WHEN fee_mode = 'percentage' THEN 'percentage'
  WHEN fee_mode = 'rent_band' THEN 'rent_band'
  ELSE 'fixed'
END
WHERE fee_structure IS NULL OR fee_structure = 'fixed';

-- 2. New fee tables
CREATE TABLE IF NOT EXISTS public.complaint_fee_fixed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_type_id uuid NOT NULL UNIQUE REFERENCES public.complaint_types(id) ON DELETE CASCADE,
  fee_amount numeric NOT NULL DEFAULT 0,
  igf_pct numeric NOT NULL DEFAULT 70,
  admin_pct numeric NOT NULL DEFAULT 20,
  platform_pct numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (round((igf_pct + admin_pct + platform_pct)::numeric, 2) = 100)
);

CREATE TABLE IF NOT EXISTS public.complaint_fee_bands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_type_id uuid NOT NULL REFERENCES public.complaint_types(id) ON DELETE CASCADE,
  band_label text NOT NULL,
  rent_min numeric NOT NULL DEFAULT 0,
  rent_max numeric,
  fee_amount numeric NOT NULL DEFAULT 0,
  igf_pct numeric NOT NULL DEFAULT 70,
  admin_pct numeric NOT NULL DEFAULT 20,
  platform_pct numeric NOT NULL DEFAULT 10,
  display_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (round((igf_pct + admin_pct + platform_pct)::numeric, 2) = 100),
  CHECK (rent_max IS NULL OR rent_max >= rent_min)
);
CREATE INDEX IF NOT EXISTS idx_complaint_fee_bands_type_min ON public.complaint_fee_bands(complaint_type_id, rent_min);

CREATE TABLE IF NOT EXISTS public.complaint_fee_percentage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_type_id uuid NOT NULL UNIQUE REFERENCES public.complaint_types(id) ON DELETE CASCADE,
  base_source text NOT NULL DEFAULT 'monthly_rent' CHECK (base_source IN ('monthly_rent','claim_amount')),
  threshold_amount numeric NOT NULL DEFAULT 500,
  below_threshold_pct numeric NOT NULL DEFAULT 0,
  above_threshold_pct numeric NOT NULL DEFAULT 0,
  igf_pct numeric NOT NULL DEFAULT 70,
  admin_pct numeric NOT NULL DEFAULT 20,
  platform_pct numeric NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CHECK (round((igf_pct + admin_pct + platform_pct)::numeric, 2) = 100)
);

-- 3. RLS for new tables (mirror complaint_types)
ALTER TABLE public.complaint_fee_fixed ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_fee_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaint_fee_percentage ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated read complaint_fee_fixed" ON public.complaint_fee_fixed FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Main admins write complaint_fee_fixed" ON public.complaint_fee_fixed FOR ALL TO authenticated USING (is_main_admin(auth.uid())) WITH CHECK (is_main_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated read complaint_fee_bands" ON public.complaint_fee_bands FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Main admins write complaint_fee_bands" ON public.complaint_fee_bands FOR ALL TO authenticated USING (is_main_admin(auth.uid())) WITH CHECK (is_main_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated read complaint_fee_percentage" ON public.complaint_fee_percentage FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Main admins write complaint_fee_percentage" ON public.complaint_fee_percentage FOR ALL TO authenticated USING (is_main_admin(auth.uid())) WITH CHECK (is_main_admin(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Add linked_property_id and claim_amount to complaints + landlord_complaints
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS linked_property_id uuid,
  ADD COLUMN IF NOT EXISTS claim_amount numeric;

ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS linked_property_id uuid,
  ADD COLUMN IF NOT EXISTS claim_amount numeric;

-- 5. Seed: deactivate legacy generic types
UPDATE public.complaint_types
SET active = false
WHERE key IN ('illegal_eviction','rent_overcharge','property_condition','harassment','lease_violation','side_payment','other');

-- 6. Seed 18 official types (idempotent on key)
WITH seed_types(key, label, fee_structure, requires_property_link, display_order) AS (VALUES
  -- Fixed (13)
  ('filing_against_absconded_tenant', 'Filing Against Absconded Tenant', 'fixed', false, 100),
  ('authority_force_open_door', 'Authority to Force Open Door (Absconded Tenant)', 'fixed', false, 110),
  ('referral_to_rent_magistrate', 'Referral to Rent Magistrate', 'fixed', false, 120),
  ('absconding_writ', 'Absconding Writ', 'fixed', false, 130),
  ('filing_notice_of_appeal', 'Filing Notice of Appeal (Final Judgment)', 'fixed', false, 140),
  ('extension_of_time_residential', 'Extension of Time – Residential', 'fixed', false, 150),
  ('extension_of_time_commercial', 'Extension of Time – Commercial', 'fixed', false, 160),
  ('filing_letter_absent_hearing', 'Filing Letter to be Absent from Hearing', 'fixed', false, 170),
  ('witness_summons', 'Witness Summons', 'fixed', false, 180),
  ('inspection', 'Inspection (paid by both parties)', 'fixed', false, 190),
  ('filing_document_general', 'Filing Document (General)', 'fixed', false, 200),
  ('archive_search', 'Archive Search (per 6 months)', 'fixed', false, 210),
  ('swearing_affidavit', 'Swearing Affidavit / Statutory Declaration', 'fixed', false, 220),
  -- Rent band (2)
  ('filing_of_complaint', 'Filing of Complaint', 'rent_band', true, 10),
  ('counterclaim', 'Counterclaim', 'rent_band', true, 20),
  -- Percentage (3)
  ('appeal_against_assessment', 'Appeal Against Assessment', 'percentage', true, 300),
  ('payment_into_office', 'Payment Into Office (arrears / claims)', 'percentage', false, 310),
  ('withdrawal_of_money', 'Withdrawal of Money', 'percentage', false, 320)
)
INSERT INTO public.complaint_types (key, label, fee_mode, fee_structure, requires_property_link, display_order, active)
SELECT s.key, s.label, s.fee_structure, s.fee_structure, s.requires_property_link, s.display_order, true
FROM seed_types s
ON CONFLICT (key) DO UPDATE
SET label = EXCLUDED.label,
    fee_structure = EXCLUDED.fee_structure,
    requires_property_link = EXCLUDED.requires_property_link,
    display_order = EXCLUDED.display_order,
    active = true;

-- 7. Seed fixed fee rows (placeholder fee_amount=0, default split 70/20/10)
INSERT INTO public.complaint_fee_fixed (complaint_type_id)
SELECT id FROM public.complaint_types
WHERE fee_structure = 'fixed' AND active = true
ON CONFLICT (complaint_type_id) DO NOTHING;

-- 8. Seed rent bands for the 2 rent-band types
WITH bands(label, rmin, rmax, ord) AS (VALUES
  ('Band 1: GHS 0 – 200', 0, 200, 1),
  ('Band 2: GHS 201 – 1,000', 201, 1000, 2),
  ('Band 3: GHS 1,001 – 2,000', 1001, 2000, 3),
  ('Band 4: Above GHS 2,000', 2001, NULL, 4)
)
INSERT INTO public.complaint_fee_bands (complaint_type_id, band_label, rent_min, rent_max, display_order)
SELECT ct.id, b.label, b.rmin, b.rmax, b.ord
FROM public.complaint_types ct
CROSS JOIN bands b
WHERE ct.key IN ('filing_of_complaint','counterclaim')
  AND NOT EXISTS (
    SELECT 1 FROM public.complaint_fee_bands fb
    WHERE fb.complaint_type_id = ct.id AND fb.display_order = b.ord
  );

-- 9. Seed percentage rules
INSERT INTO public.complaint_fee_percentage (complaint_type_id, base_source, threshold_amount, below_threshold_pct, above_threshold_pct)
SELECT id, 'monthly_rent', 500, 50, 100 FROM public.complaint_types WHERE key = 'appeal_against_assessment'
ON CONFLICT (complaint_type_id) DO NOTHING;

INSERT INTO public.complaint_fee_percentage (complaint_type_id, base_source, threshold_amount, below_threshold_pct, above_threshold_pct)
SELECT id, 'claim_amount', 500, 5, 10 FROM public.complaint_types WHERE key = 'payment_into_office'
ON CONFLICT (complaint_type_id) DO NOTHING;

INSERT INTO public.complaint_fee_percentage (complaint_type_id, base_source, threshold_amount, below_threshold_pct, above_threshold_pct)
SELECT id, 'claim_amount', 500, 1, 0.26 FROM public.complaint_types WHERE key = 'withdrawal_of_money'
ON CONFLICT (complaint_type_id) DO NOTHING;