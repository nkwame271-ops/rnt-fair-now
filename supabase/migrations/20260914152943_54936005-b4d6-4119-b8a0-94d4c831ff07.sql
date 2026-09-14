ALTER TABLE public.rent_card_serial_stock
  DROP CONSTRAINT IF EXISTS rent_card_serial_stock_serial_pair_unique;

CREATE UNIQUE INDEX IF NOT EXISTS rent_card_serial_stock_active_serial_pair_unique
  ON public.rent_card_serial_stock (serial_number, pair_index)
  WHERE status <> 'revoked';

ALTER TABLE public.rent_card_serial_stock
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS source_note text,
  ADD COLUMN IF NOT EXISTS is_reupload boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_rcss_serial_history
  ON public.rent_card_serial_stock (serial_number, created_at DESC);