-- Add pair tracking columns to rent_card_serial_stock
ALTER TABLE public.rent_card_serial_stock
ADD COLUMN pair_index integer,
ADD COLUMN pair_group text;

-- Create daily_stock_reports table
CREATE TABLE public.daily_stock_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  office_id text NOT NULL,
  office_name text NOT NULL,
  staff_user_id uuid NOT NULL,
  staff_name text NOT NULL,
  report_date date NOT NULL,
  opening_pairs integer NOT NULL DEFAULT 0,
  assigned_today integer NOT NULL DEFAULT 0,
  sold_today integer NOT NULL DEFAULT 0,
  spoilt_today integer NOT NULL DEFAULT 0,
  closing_pairs integer NOT NULL DEFAULT 0,
  notes text,
  signed_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_stock_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators can read daily stock reports"
ON public.daily_stock_reports
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators can insert daily stock reports"
ON public.daily_stock_reports
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages daily stock reports"
ON public.daily_stock_reports
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);