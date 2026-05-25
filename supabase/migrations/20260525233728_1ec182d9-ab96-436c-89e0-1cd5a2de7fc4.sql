ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS sales_channel_id uuid REFERENCES public.rent_card_sales_channels(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel_permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_admin_staff_sales_channel ON public.admin_staff(sales_channel_id);