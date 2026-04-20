-- Composite & partial indexes on rent_card_serial_stock
CREATE INDEX IF NOT EXISTS idx_rcss_office_status_pair
  ON public.rent_card_serial_stock (office_name, status, pair_index);

CREATE INDEX IF NOT EXISTS idx_rcss_region_status_pair
  ON public.rent_card_serial_stock (region, status, pair_index);

CREATE INDEX IF NOT EXISTS idx_rcss_serial
  ON public.rent_card_serial_stock (serial_number);

CREATE INDEX IF NOT EXISTS idx_rcss_batch_label
  ON public.rent_card_serial_stock (batch_label) WHERE batch_label IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rcss_unassigned_at
  ON public.rent_card_serial_stock (unassigned_at) WHERE unassigned_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rcss_stock_type
  ON public.rent_card_serial_stock (stock_type, office_name);

CREATE INDEX IF NOT EXISTS idx_rcss_fifo
  ON public.rent_card_serial_stock (office_name, status, pair_index, stock_source, created_at);

-- Summary RPC: pre-aggregated office stock counts (replaces fetching 261K rows client-side)
CREATE OR REPLACE FUNCTION public.rcss_office_summary()
RETURNS TABLE (
  region text,
  office_name text,
  available_pairs bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    region,
    office_name,
    COUNT(*)::bigint AS available_pairs
  FROM public.rent_card_serial_stock
  WHERE stock_type = 'office'
    AND status = 'available'
    AND (pair_index = 1 OR pair_index IS NULL)
  GROUP BY region, office_name;
$$;

GRANT EXECUTE ON FUNCTION public.rcss_office_summary() TO authenticated;