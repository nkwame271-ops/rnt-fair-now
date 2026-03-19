
CREATE TABLE public.serial_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id text NOT NULL,
  landlord_user_id uuid NOT NULL,
  office_name text NOT NULL,
  assigned_by uuid NOT NULL,
  serial_numbers text[] NOT NULL DEFAULT '{}',
  card_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.serial_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read assignments" ON public.serial_assignments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators insert assignments" ON public.serial_assignments
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

ALTER TABLE public.rent_card_serial_stock
  ADD COLUMN IF NOT EXISTS assigned_by uuid,
  ADD COLUMN IF NOT EXISTS batch_label text;

ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS stock_alert_threshold integer DEFAULT 50;
