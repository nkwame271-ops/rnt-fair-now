
ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS fee_type text DEFAULT 'fixed' CHECK (fee_type IN ('fixed','percentage')),
  ADD COLUMN IF NOT EXISTS billing_frequency text DEFAULT 'one_time' CHECK (billing_frequency IN ('one_time','monthly','quarterly','yearly')),
  ADD COLUMN IF NOT EXISTS revenue_split_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_destination text DEFAULT 'platform' CHECK (payment_destination IN ('platform','office','landlord','split')),
  ADD COLUMN IF NOT EXISTS expiry_days integer,
  ADD COLUMN IF NOT EXISTS renewal_days integer,
  ADD COLUMN IF NOT EXISTS grace_period_days integer DEFAULT 0;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS transaction_pin_hash text;
