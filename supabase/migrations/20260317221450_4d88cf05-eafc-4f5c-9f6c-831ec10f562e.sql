
-- Receipt number sequence
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START WITH 1001;

-- Generate receipt number function
CREATE OR REPLACE FUNCTION public.generate_receipt_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'RCT-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('receipt_number_seq')::text, 4, '0');
END;
$$;

-- Escrow transactions table
CREATE TABLE public.escrow_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_type text NOT NULL,
  reference text UNIQUE,
  paystack_transaction_id text,
  total_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'GHS',
  status text NOT NULL DEFAULT 'pending',
  related_tenancy_id uuid,
  related_complaint_id uuid,
  related_property_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.escrow_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own escrow transactions" ON public.escrow_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users insert own escrow transactions" ON public.escrow_transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Regulators read all escrow transactions" ON public.escrow_transactions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages escrow" ON public.escrow_transactions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Escrow splits table
CREATE TABLE public.escrow_splits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_transaction_id uuid NOT NULL REFERENCES public.escrow_transactions(id) ON DELETE CASCADE,
  recipient text NOT NULL,
  amount numeric NOT NULL,
  description text,
  disbursement_status text NOT NULL DEFAULT 'pending',
  released_at timestamptz
);

ALTER TABLE public.escrow_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own splits" ON public.escrow_splits
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.escrow_transactions et WHERE et.id = escrow_transaction_id AND et.user_id = auth.uid())
  );

CREATE POLICY "Regulators read all splits" ON public.escrow_splits
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages splits" ON public.escrow_splits
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Payment receipts table
CREATE TABLE public.payment_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text UNIQUE NOT NULL DEFAULT generate_receipt_number(),
  escrow_transaction_id uuid REFERENCES public.escrow_transactions(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  payer_name text,
  payer_email text,
  total_amount numeric NOT NULL,
  payment_type text NOT NULL,
  description text,
  split_breakdown jsonb DEFAULT '[]'::jsonb,
  tenancy_id uuid,
  qr_code_data text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own receipts" ON public.payment_receipts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Regulators read all receipts" ON public.payment_receipts
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Landlords read receipts for their tenancies" ON public.payment_receipts
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tenancies t WHERE t.id = payment_receipts.tenancy_id AND t.landlord_user_id = auth.uid())
  );

CREATE POLICY "Service role manages receipts" ON public.payment_receipts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Landlord payment settings table
CREATE TABLE public.landlord_payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_user_id uuid NOT NULL UNIQUE,
  payment_method text NOT NULL DEFAULT 'momo',
  momo_number text,
  momo_provider text,
  bank_name text,
  bank_branch text,
  account_number text,
  account_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.landlord_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords manage own payment settings" ON public.landlord_payment_settings
  FOR ALL TO authenticated USING (auth.uid() = landlord_user_id) WITH CHECK (auth.uid() = landlord_user_id);

CREATE POLICY "Regulators read all payment settings" ON public.landlord_payment_settings
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'regulator'::app_role));
