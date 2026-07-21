
CREATE TABLE IF NOT EXISTS public.cashbook_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  receipt_no TEXT,
  payment_ref TEXT UNIQUE,
  description TEXT,
  category TEXT,
  payer TEXT,
  office TEXT,
  channel TEXT,
  method TEXT,
  money_in NUMERIC(14,2) NOT NULL DEFAULT 0,
  money_out NUMERIC(14,2) NOT NULL DEFAULT 0,
  running_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  reconciliation_status TEXT NOT NULL DEFAULT 'reconciled',
  source_receipt_id UUID REFERENCES public.payment_receipts(id) ON DELETE SET NULL,
  recorded_by UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cashbook_entries TO authenticated;
GRANT ALL ON public.cashbook_entries TO service_role;

ALTER TABLE public.cashbook_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Regulators and admins can view cashbook"
  ON public.cashbook_entries
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulator'::app_role)
    OR public.is_main_admin(auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_cashbook_entry_date ON public.cashbook_entries (entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_cashbook_category ON public.cashbook_entries (category);
CREATE INDEX IF NOT EXISTS idx_cashbook_office ON public.cashbook_entries (office);

DROP TRIGGER IF EXISTS update_cashbook_entries_updated_at ON public.cashbook_entries;
CREATE TRIGGER update_cashbook_entries_updated_at
  BEFORE UPDATE ON public.cashbook_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.post_receipt_to_cashbook()
RETURNS TRIGGER AS $$
DECLARE
  v_ref TEXT;
  v_prev_balance NUMERIC(14,2);
  v_amount NUMERIC(14,2);
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed'
     AND NEW.status IS DISTINCT FROM 'paid'
     AND NEW.status IS DISTINCT FROM 'issued' THEN
    RETURN NEW;
  END IF;

  v_ref := COALESCE(NEW.paystack_reference, NEW.platform_reference, NEW.receipt_number, NEW.id::text);
  v_amount := COALESCE(NEW.total_amount, 0);

  IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE payment_ref = v_ref) THEN
    RETURN NEW;
  END IF;

  SELECT running_balance INTO v_prev_balance
  FROM public.cashbook_entries
  ORDER BY entry_date DESC, created_at DESC
  LIMIT 1;

  v_prev_balance := COALESCE(v_prev_balance, 0);

  INSERT INTO public.cashbook_entries (
    entry_date, receipt_no, payment_ref, description, category,
    payer, office, channel, method, money_in, money_out, running_balance,
    reconciliation_status, source_receipt_id, metadata
  ) VALUES (
    COALESCE(NEW.payment_date, NEW.reconciliation_date, NEW.created_at, now()),
    NEW.receipt_number,
    v_ref,
    COALESCE(NEW.description, NEW.payment_type),
    COALESCE(NEW.service_type, NEW.payment_type, 'other'),
    NEW.payer_name,
    NEW.office_id,
    'paystack',
    NEW.payment_method,
    v_amount,
    0,
    v_prev_balance + v_amount,
    CASE WHEN NEW.reconciliation_date IS NOT NULL THEN 'reconciled' ELSE 'pending' END,
    NEW.id,
    jsonb_build_object(
      'payment_type', NEW.payment_type,
      'service_type', NEW.service_type,
      'tenancy_id', NEW.tenancy_id,
      'case_id', NEW.case_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_post_receipt_to_cashbook_ins ON public.payment_receipts;
CREATE TRIGGER trg_post_receipt_to_cashbook_ins
  AFTER INSERT ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.post_receipt_to_cashbook();

DROP TRIGGER IF EXISTS trg_post_receipt_to_cashbook_upd ON public.payment_receipts;
CREATE TRIGGER trg_post_receipt_to_cashbook_upd
  AFTER UPDATE OF status, reconciliation_date ON public.payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.post_receipt_to_cashbook();

INSERT INTO public.cashbook_entries (
  entry_date, receipt_no, payment_ref, description, category,
  payer, office, channel, method, money_in, money_out, running_balance,
  reconciliation_status, source_receipt_id, metadata
)
SELECT
  COALESCE(r.payment_date, r.reconciliation_date, r.created_at, now()) AS entry_date,
  r.receipt_number,
  COALESCE(r.paystack_reference, r.platform_reference, r.receipt_number, r.id::text) AS payment_ref,
  COALESCE(r.description, r.payment_type),
  COALESCE(r.service_type, r.payment_type, 'other'),
  r.payer_name,
  r.office_id,
  'paystack',
  r.payment_method,
  COALESCE(r.total_amount, 0),
  0,
  SUM(COALESCE(r.total_amount, 0)) OVER (
    ORDER BY COALESCE(r.payment_date, r.reconciliation_date, r.created_at, now()), r.id
  ),
  CASE WHEN r.reconciliation_date IS NOT NULL THEN 'reconciled' ELSE 'pending' END,
  r.id,
  jsonb_build_object(
    'payment_type', r.payment_type,
    'service_type', r.service_type,
    'tenancy_id', r.tenancy_id,
    'case_id', r.case_id
  )
FROM public.payment_receipts r
WHERE r.status IN ('completed','paid','issued')
  AND NOT EXISTS (
    SELECT 1 FROM public.cashbook_entries c
    WHERE c.payment_ref = COALESCE(r.paystack_reference, r.platform_reference, r.receipt_number, r.id::text)
  );
