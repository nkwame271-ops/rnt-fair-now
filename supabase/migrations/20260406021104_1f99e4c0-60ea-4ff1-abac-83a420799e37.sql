
-- 1. Add office tracking to rent_cards
ALTER TABLE public.rent_cards
  ADD COLUMN assigned_office_id text,
  ADD COLUMN assigned_office_name text;

-- 2. Create office_reconciliation_snapshots table
CREATE TABLE public.office_reconciliation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  office_name text NOT NULL,
  snapshot_date date NOT NULL,
  total_office_stock integer NOT NULL DEFAULT 0,
  available_pairs integer NOT NULL DEFAULT 0,
  assigned_pairs integer NOT NULL DEFAULT 0,
  sold_pairs integer NOT NULL DEFAULT 0,
  spoilt_pairs integer NOT NULL DEFAULT 0,
  pending_purchases integer NOT NULL DEFAULT 0,
  fulfilled_purchases integer NOT NULL DEFAULT 0,
  discrepancy_notes text,
  is_balanced boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(office_id, snapshot_date)
);

ALTER TABLE public.office_reconciliation_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read reconciliation snapshots"
  ON public.office_reconciliation_snapshots
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators insert reconciliation snapshots"
  ON public.office_reconciliation_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages reconciliation snapshots"
  ON public.office_reconciliation_snapshots
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
