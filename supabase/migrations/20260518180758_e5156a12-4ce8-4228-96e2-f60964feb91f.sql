DO $$ BEGIN
  CREATE TYPE public.payment_intent_status AS ENUM (
    'pending',
    'paystack_success',
    'fulfilled',
    'failed',
    'abandoned',
    'reconciliation_required',
    'manually_reconciled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_fulfillment_status AS ENUM (
    'pending',
    'fulfilled',
    'failed',
    'reconciliation_required',
    'manually_reconciled',
    'duplicate_blocked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_reconciliation_actor_type AS ENUM (
    'system',
    'webhook',
    'callback',
    'recovery_worker',
    'admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_receipt_status AS ENUM (
    'auto_generated',
    'manually_reconciled',
    'duplicate_blocked',
    'voided'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.admin_staff
ADD COLUMN IF NOT EXISTS payment_permissions jsonb NOT NULL DEFAULT jsonb_build_object(
  'view_payment_reconciliation', false,
  'verify_paystack_transaction', false,
  'reconcile_payment', false,
  'select_reconciliation_officer', false,
  'generate_reconciled_receipt', false,
  'export_reconciliation_report', false
);

CREATE OR REPLACE FUNCTION public.has_payment_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.is_main_admin(_user_id)
    OR public.is_super_admin(_user_id)
    OR (
      SELECT COALESCE((payment_permissions ->> _perm)::boolean, false)
      FROM public.admin_staff
      WHERE user_id = _user_id
      LIMIT 1
    ),
    false
  )
$$;

CREATE TABLE IF NOT EXISTS public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_reference text NOT NULL UNIQUE,
  paystack_reference text UNIQUE,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  user_id uuid,
  user_type text,
  service_type text NOT NULL,
  service_record_id text,
  office_id text REFERENCES public.offices(id) ON DELETE SET NULL,
  officer_id uuid,
  expected_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  payment_provider text NOT NULL DEFAULT 'paystack',
  customer_name text,
  customer_phone text,
  customer_email text,
  status public.payment_intent_status NOT NULL DEFAULT 'pending',
  failure_reason text,
  fulfilled_at timestamptz,
  abandoned_at timestamptz,
  last_verified_at timestamptz,
  escrow_transaction_id uuid REFERENCES public.escrow_transactions(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payment intents" ON public.payment_intents;
CREATE POLICY "Users read own payment intents"
ON public.payment_intents
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authorized admins read payment intents" ON public.payment_intents;
CREATE POLICY "Authorized admins read payment intents"
ON public.payment_intents
FOR SELECT
TO authenticated
USING (public.has_payment_permission(auth.uid(), 'view_payment_reconciliation'));

DROP POLICY IF EXISTS "Service role manages payment intents" ON public.payment_intents;
CREATE POLICY "Service role manages payment intents"
ON public.payment_intents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payment_fulfillments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  escrow_transaction_id uuid REFERENCES public.escrow_transactions(id) ON DELETE SET NULL,
  receipt_id uuid REFERENCES public.payment_receipts(id) ON DELETE SET NULL,
  user_id uuid,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  office_id text REFERENCES public.offices(id) ON DELETE SET NULL,
  officer_id uuid,
  service_type text NOT NULL,
  service_record_id text,
  platform_reference text NOT NULL,
  paystack_reference text NOT NULL,
  paystack_transaction_id text,
  payment_provider text NOT NULL DEFAULT 'paystack',
  expected_amount numeric,
  paid_amount numeric NOT NULL DEFAULT 0,
  gross_amount numeric NOT NULL DEFAULT 0,
  paystack_fee numeric NOT NULL DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'GHS',
  allocation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  fulfillment_status public.payment_fulfillment_status NOT NULL DEFAULT 'pending',
  fulfilled_via public.payment_reconciliation_actor_type,
  fulfilled_at timestamptz,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_fulfillments_paystack_reference_key UNIQUE (paystack_reference),
  CONSTRAINT payment_fulfillments_platform_reference_key UNIQUE (platform_reference)
);

ALTER TABLE public.payment_fulfillments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payment fulfillments" ON public.payment_fulfillments;
CREATE POLICY "Users read own payment fulfillments"
ON public.payment_fulfillments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authorized admins read payment fulfillments" ON public.payment_fulfillments;
CREATE POLICY "Authorized admins read payment fulfillments"
ON public.payment_fulfillments
FOR SELECT
TO authenticated
USING (public.has_payment_permission(auth.uid(), 'view_payment_reconciliation'));

DROP POLICY IF EXISTS "Service role manages payment fulfillments" ON public.payment_fulfillments;
CREATE POLICY "Service role manages payment fulfillments"
ON public.payment_fulfillments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.payment_reconciliation_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type public.payment_reconciliation_actor_type NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  paystack_reference text,
  platform_reference text,
  payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
  payment_fulfillment_id uuid REFERENCES public.payment_fulfillments(id) ON DELETE SET NULL,
  case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
  service_type text,
  user_id uuid,
  office_id text REFERENCES public.offices(id) ON DELETE SET NULL,
  officer_id uuid,
  old_status text,
  new_status text,
  amount numeric,
  allocation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text,
  ip_address text,
  user_agent text,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_reconciliation_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authorized admins read payment reconciliation audit" ON public.payment_reconciliation_audit_log;
CREATE POLICY "Authorized admins read payment reconciliation audit"
ON public.payment_reconciliation_audit_log
FOR SELECT
TO authenticated
USING (public.has_payment_permission(auth.uid(), 'view_payment_reconciliation'));

DROP POLICY IF EXISTS "Service role manages payment reconciliation audit" ON public.payment_reconciliation_audit_log;
CREATE POLICY "Service role manages payment reconciliation audit"
ON public.payment_reconciliation_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

ALTER TABLE public.escrow_transactions
ADD COLUMN IF NOT EXISTS payment_intent_id uuid REFERENCES public.payment_intents(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS officer_id uuid,
ADD COLUMN IF NOT EXISTS service_record_id text;

ALTER TABLE public.payment_receipts
ADD COLUMN IF NOT EXISTS platform_reference text,
ADD COLUMN IF NOT EXISTS paystack_reference text,
ADD COLUMN IF NOT EXISTS case_id uuid REFERENCES public.cases(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS service_type text,
ADD COLUMN IF NOT EXISTS service_record_id text,
ADD COLUMN IF NOT EXISTS officer_id uuid,
ADD COLUMN IF NOT EXISTS payer_phone text,
ADD COLUMN IF NOT EXISTS payment_date timestamptz,
ADD COLUMN IF NOT EXISTS reconciliation_date timestamptz,
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS receipt_status public.payment_receipt_status NOT NULL DEFAULT 'auto_generated',
ADD COLUMN IF NOT EXISTS generated_by_type public.payment_reconciliation_actor_type,
ADD COLUMN IF NOT EXISTS generated_by_admin_id uuid,
ADD COLUMN IF NOT EXISTS reconciliation_notes text;

CREATE INDEX IF NOT EXISTS idx_payment_intents_status_created
ON public.payment_intents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_intents_reference_search
ON public.payment_intents (platform_reference, paystack_reference);

CREATE INDEX IF NOT EXISTS idx_payment_intents_service_lookup
ON public.payment_intents (service_type, office_id, officer_id, user_id);

CREATE INDEX IF NOT EXISTS idx_payment_fulfillments_status_created
ON public.payment_fulfillments (fulfillment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_fulfillments_service_lookup
ON public.payment_fulfillments (service_type, office_id, officer_id, user_id);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_audit_created
ON public.payment_reconciliation_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_audit_reference
ON public.payment_reconciliation_audit_log (paystack_reference, platform_reference);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_reference_lookup
ON public.payment_receipts (platform_reference, paystack_reference);

CREATE INDEX IF NOT EXISTS idx_payment_receipts_case_service
ON public.payment_receipts (case_id, service_type, office_id, officer_id);

DROP TRIGGER IF EXISTS update_payment_intents_updated_at ON public.payment_intents;
CREATE TRIGGER update_payment_intents_updated_at
BEFORE UPDATE ON public.payment_intents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_payment_fulfillments_updated_at ON public.payment_fulfillments;
CREATE TRIGGER update_payment_fulfillments_updated_at
BEFORE UPDATE ON public.payment_fulfillments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();