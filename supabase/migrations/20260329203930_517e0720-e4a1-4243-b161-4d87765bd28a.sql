
-- Office fund requests table
CREATE TABLE public.office_fund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id),
  requested_by uuid NOT NULL,
  amount numeric NOT NULL,
  purpose text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  reviewer_notes text,
  payout_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_fund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read all fund requests" ON public.office_fund_requests
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators insert fund requests" ON public.office_fund_requests
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Main admins update fund requests" ON public.office_fund_requests
  FOR UPDATE TO authenticated
  USING (is_main_admin(auth.uid()));

CREATE POLICY "Service role manages fund requests" ON public.office_fund_requests
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Office payout accounts table
CREATE TABLE public.office_payout_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id text NOT NULL REFERENCES public.offices(id) UNIQUE,
  payment_method text NOT NULL DEFAULT 'momo',
  momo_number text,
  momo_provider text,
  bank_name text,
  account_number text,
  account_name text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_payout_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators read payout accounts" ON public.office_payout_accounts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Regulators manage payout accounts" ON public.office_payout_accounts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'regulator'::app_role))
  WITH CHECK (has_role(auth.uid(), 'regulator'::app_role));

CREATE POLICY "Service role manages payout accounts" ON public.office_payout_accounts
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
