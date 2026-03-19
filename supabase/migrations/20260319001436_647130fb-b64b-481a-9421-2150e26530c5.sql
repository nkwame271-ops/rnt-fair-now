
-- 1. Create rent_card_serial_stock table
CREATE TABLE public.rent_card_serial_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial_number text UNIQUE NOT NULL,
  office_name text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  assigned_to_card_id uuid REFERENCES public.rent_cards(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_at timestamp with time zone
);

ALTER TABLE public.rent_card_serial_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can read all serial stock"
  ON public.rent_card_serial_stock FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Regulators can insert serial stock"
  ON public.rent_card_serial_stock FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Regulators can update serial stock"
  ON public.rent_card_serial_stock FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Service role manages serial stock"
  ON public.rent_card_serial_stock FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Alter rent_cards: make serial_number nullable, add purchase_id
ALTER TABLE public.rent_cards ALTER COLUMN serial_number DROP NOT NULL;
ALTER TABLE public.rent_cards ALTER COLUMN serial_number DROP DEFAULT;
ALTER TABLE public.rent_cards ADD COLUMN IF NOT EXISTS purchase_id text;

-- 3. Create purchase_id sequence
CREATE SEQUENCE IF NOT EXISTS purchase_id_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_purchase_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 'PUR-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('purchase_id_seq')::text, 4, '0');
END;
$$;
