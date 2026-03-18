
-- Sequence for rent card serial numbers
CREATE SEQUENCE IF NOT EXISTS rent_card_serial_seq START 1;

-- Function to generate rent card serial number
CREATE OR REPLACE FUNCTION public.generate_rent_card_serial()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'RC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('rent_card_serial_seq')::text, 4, '0');
END;
$$;

-- Create rent_cards table
CREATE TABLE public.rent_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text NOT NULL UNIQUE DEFAULT generate_rent_card_serial(),
  landlord_user_id uuid NOT NULL,
  tenancy_id uuid REFERENCES public.tenancies(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'valid',
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  activated_at timestamp with time zone,
  escrow_transaction_id uuid REFERENCES public.escrow_transactions(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add rent_card_id to tenancies
ALTER TABLE public.tenancies ADD COLUMN rent_card_id uuid REFERENCES public.rent_cards(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.rent_cards ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Landlords manage own rent cards"
  ON public.rent_cards FOR ALL
  TO authenticated
  USING (auth.uid() = landlord_user_id)
  WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all rent cards"
  ON public.rent_cards FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Service role manages rent cards"
  ON public.rent_cards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
