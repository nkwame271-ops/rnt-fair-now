
-- 1. Sales channels table
CREATE TABLE public.rent_card_sales_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  default_office_id text REFERENCES public.offices(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.rent_card_sales_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage sales channels"
  ON public.rent_card_sales_channels
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Service role manages sales channels"
  ON public.rent_card_sales_channels
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_rent_card_sales_channels_updated_at
  BEFORE UPDATE ON public.rent_card_sales_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Per-channel splits
CREATE TABLE public.rent_card_channel_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.rent_card_sales_channels(id) ON DELETE CASCADE,
  recipient text NOT NULL CHECK (recipient IN ('igf','platform','admin')),
  amount_type text NOT NULL DEFAULT 'percent' CHECK (amount_type IN ('percent','flat')),
  amount numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (channel_id, recipient)
);

ALTER TABLE public.rent_card_channel_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage channel splits"
  ON public.rent_card_channel_splits
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Service role manages channel splits"
  ON public.rent_card_channel_splits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TRIGGER set_rent_card_channel_splits_updated_at
  BEFORE UPDATE ON public.rent_card_channel_splits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add sales_channel_id to existing tables
ALTER TABLE public.rent_card_serial_stock
  ADD COLUMN sales_channel_id uuid REFERENCES public.rent_card_sales_channels(id) ON DELETE SET NULL;

ALTER TABLE public.escrow_transactions
  ADD COLUMN sales_channel_id uuid REFERENCES public.rent_card_sales_channels(id) ON DELETE SET NULL;

ALTER TABLE public.rent_cards
  ADD COLUMN sales_channel_id uuid REFERENCES public.rent_card_sales_channels(id) ON DELETE SET NULL;

CREATE INDEX idx_rcss_sales_channel ON public.rent_card_serial_stock(sales_channel_id) WHERE sales_channel_id IS NOT NULL;
CREATE INDEX idx_escrow_sales_channel ON public.escrow_transactions(sales_channel_id) WHERE sales_channel_id IS NOT NULL;
CREATE INDEX idx_rent_cards_sales_channel ON public.rent_cards(sales_channel_id) WHERE sales_channel_id IS NOT NULL;

-- 4. Seed default channels + default splits (50/30/20 IGF/Platform/Admin)
INSERT INTO public.rent_card_sales_channels (code, name, description) VALUES
  ('rent_control_office', 'Rent Control Office', 'Standard rent card sales through the regional rent control office'),
  ('central_procurement', 'Central Procurement Channel', 'Bulk procurement managed centrally'),
  ('nugs_channel', 'NUGS Channel', 'Sales routed through the NUGS partnership'),
  ('field_agent', 'Field Agent Channel', 'Sales through accredited field agents')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.rent_card_channel_splits (channel_id, recipient, amount_type, amount, sort_order)
SELECT c.id, x.recipient, 'percent', x.amount, x.sort_order
FROM public.rent_card_sales_channels c
CROSS JOIN (VALUES
  ('igf', 50, 1),
  ('platform', 30, 2),
  ('admin', 20, 3)
) AS x(recipient, amount, sort_order)
ON CONFLICT (channel_id, recipient) DO NOTHING;
