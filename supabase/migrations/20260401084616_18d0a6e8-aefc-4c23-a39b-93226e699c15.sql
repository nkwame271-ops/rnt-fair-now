
-- 1. Create split_configurations table
CREATE TABLE public.split_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_type text NOT NULL,
  recipient text NOT NULL,
  amount_type text NOT NULL DEFAULT 'flat',
  amount numeric NOT NULL DEFAULT 0,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_platform_fee boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(payment_type, recipient, sort_order)
);

ALTER TABLE public.split_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage split configs" ON public.split_configurations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages split configs" ON public.split_configurations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read split configs" ON public.split_configurations
  FOR SELECT TO authenticated
  USING (true);

-- 2. Create secondary_split_configurations table
CREATE TABLE public.secondary_split_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_recipient text NOT NULL,
  sub_recipient text NOT NULL,
  percentage numeric NOT NULL DEFAULT 0,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(parent_recipient, sub_recipient)
);

ALTER TABLE public.secondary_split_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage secondary splits" ON public.secondary_split_configurations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages secondary splits" ON public.secondary_split_configurations
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated read secondary splits" ON public.secondary_split_configurations
  FOR SELECT TO authenticated
  USING (true);

-- 3. Create system_settlement_accounts table
CREATE TABLE public.system_settlement_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type text NOT NULL UNIQUE,
  payment_method text NOT NULL DEFAULT 'bank',
  account_name text,
  bank_name text,
  account_number text,
  momo_number text,
  momo_provider text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.system_settlement_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators manage settlement accounts" ON public.system_settlement_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages settlement accounts" ON public.system_settlement_accounts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. Add release_mode column to escrow_splits
ALTER TABLE public.escrow_splits ADD COLUMN IF NOT EXISTS release_mode text NOT NULL DEFAULT 'manual';

-- 5. Seed split_configurations with current hardcoded values
INSERT INTO public.split_configurations (payment_type, recipient, amount, description, sort_order, is_platform_fee) VALUES
  ('tenant_registration', 'platform', 10, 'Platform fixed fee', 0, true),
  ('tenant_registration', 'rent_control', 19.5, 'IGF - Rent Control', 1, false),
  ('tenant_registration', 'admin', 7.5, 'Admin fee', 2, false),
  ('tenant_registration', 'platform', 3, 'Platform share', 3, false),
  ('landlord_registration', 'platform', 10, 'Platform fixed fee', 0, true),
  ('landlord_registration', 'rent_control', 13, 'IGF - Rent Control', 1, false),
  ('landlord_registration', 'admin', 5, 'Admin fee', 2, false),
  ('landlord_registration', 'platform', 2, 'Platform share', 3, false),
  ('rent_card', 'rent_control', 15, 'Rent Control - Rent Card', 0, false),
  ('rent_card', 'admin', 10, 'Admin - Rent Card', 1, false),
  ('agreement_sale', 'rent_control', 10, 'Rent Control - Agreement', 0, false),
  ('agreement_sale', 'admin', 20, 'Admin - Agreement', 1, false),
  ('complaint_fee', 'platform', 2, 'Complaint filing fee', 0, false),
  ('listing_fee', 'platform', 2, 'Listing fee', 0, false),
  ('viewing_fee', 'platform', 2, 'Viewing fee', 0, false),
  ('add_tenant_fee', 'platform', 5, 'Add tenant fee', 0, false),
  ('termination_fee', 'platform', 5, 'Termination request fee', 0, false),
  ('archive_search_fee', 'rent_control', 12, 'Rent Control - Archive Search', 0, false),
  ('archive_search_fee', 'admin', 8, 'Admin - Archive Search', 1, false);

-- 6. Seed secondary_split_configurations
INSERT INTO public.secondary_split_configurations (parent_recipient, sub_recipient, percentage, description) VALUES
  ('rent_control', 'office', 60, 'Office share of IGF'),
  ('rent_control', 'headquarters', 30, 'HQ share of IGF'),
  ('rent_control', 'platform', 10, 'Platform share of IGF'),
  ('admin', 'office', 70, 'Office share of Admin'),
  ('admin', 'headquarters', 20, 'HQ share of Admin'),
  ('admin', 'platform', 10, 'Platform share of Admin');

-- 7. Seed system settlement accounts
INSERT INTO public.system_settlement_accounts (account_type) VALUES
  ('igf'), ('admin'), ('platform'), ('gra');

-- 8. Insert office_payout_mode feature flag
INSERT INTO public.feature_flags (feature_key, label, description, category, is_enabled, fee_enabled)
VALUES ('office_payout_mode', 'Office Payout Mode', 'When enabled, office funds are auto-released after allocation. When disabled, manual approval is required.', 'general', false, false)
ON CONFLICT DO NOTHING;
