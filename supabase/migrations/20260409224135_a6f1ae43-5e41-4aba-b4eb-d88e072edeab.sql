
CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL,
  office_name text NOT NULL,
  region text NOT NULL,
  adjustment_type text NOT NULL,
  quantity integer NOT NULL,
  reason text NOT NULL,
  note text,
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read inventory adjustments"
  ON public.inventory_adjustments
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages inventory adjustments"
  ON public.inventory_adjustments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
