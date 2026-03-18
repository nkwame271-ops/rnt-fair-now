
ALTER TABLE public.rent_cards
  ADD COLUMN IF NOT EXISTS tenant_user_id uuid,
  ADD COLUMN IF NOT EXISTS property_id uuid,
  ADD COLUMN IF NOT EXISTS unit_id uuid,
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS current_rent numeric,
  ADD COLUMN IF NOT EXISTS previous_rent numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_advance integer DEFAULT 6,
  ADD COLUMN IF NOT EXISTS advance_paid integer,
  ADD COLUMN IF NOT EXISTS last_payment_status text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS qr_token text UNIQUE DEFAULT gen_random_uuid()::text;
