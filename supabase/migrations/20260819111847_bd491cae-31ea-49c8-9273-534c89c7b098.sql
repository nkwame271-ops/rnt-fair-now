ALTER TABLE public.landlords
  ADD COLUMN IF NOT EXISTS office_id text REFERENCES public.offices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS region_id text;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS office_id text REFERENCES public.offices(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS region_id text;

ALTER TABLE public.admin_staff
  ADD COLUMN IF NOT EXISTS scope_type text NOT NULL DEFAULT 'SPECIFIC_OFFICES',
  ADD COLUMN IF NOT EXISTS region_id text,
  ADD COLUMN IF NOT EXISTS office_ids text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.admin_staff DROP CONSTRAINT IF EXISTS admin_staff_scope_type_check;
ALTER TABLE public.admin_staff ADD CONSTRAINT admin_staff_scope_type_check
  CHECK (scope_type IN ('ALL_REGIONS','SPECIFIC_REGION_ALL_OFFICES','SPECIFIC_OFFICES'));

ALTER TABLE public.complaint_assignments
  ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES public.hearing_rooms(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.complaint_adjournments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  case_kind text NOT NULL CHECK (case_kind IN ('complaint','landlord_complaint')),
  adjourned_to timestamptz NOT NULL,
  reason text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.complaint_adjournments TO authenticated;
GRANT ALL ON public.complaint_adjournments TO service_role;
ALTER TABLE public.complaint_adjournments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin staff read adjournments" ON public.complaint_adjournments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff s WHERE s.user_id = auth.uid()));
CREATE POLICY "Admin staff record adjournments" ON public.complaint_adjournments
  FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid() AND EXISTS (SELECT 1 FROM public.admin_staff s WHERE s.user_id = auth.uid()));
CREATE INDEX IF NOT EXISTS complaint_adjournments_case_idx
  ON public.complaint_adjournments(case_id, recorded_at DESC);

CREATE OR REPLACE FUNCTION public.admin_can_access_office(_user_id uuid, _office_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_staff s
    LEFT JOIN public.offices o ON o.id = _office_id
    WHERE s.user_id = _user_id
      AND (
        s.scope_type = 'ALL_REGIONS'
        OR (s.scope_type = 'SPECIFIC_REGION_ALL_OFFICES' AND o.region = s.region_id)
        OR (s.scope_type = 'SPECIFIC_OFFICES' AND _office_id = ANY(s.office_ids))
      )
  )
$$;
GRANT EXECUTE ON FUNCTION public.admin_can_access_office(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.complaint_payment_ready(_complaint_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM public.complaints c WHERE c.id=_complaint_id AND c.payment_status='paid')
    OR EXISTS (SELECT 1 FROM public.landlord_complaints c WHERE c.id=_complaint_id AND c.payment_status='paid')
    OR EXISTS (
      SELECT 1 FROM public.escrow_transactions e
      WHERE e.related_complaint_id=_complaint_id AND e.status IN ('completed','paid','success')
    )
    OR EXISTS (
      SELECT 1 FROM public.case_payments cp
      WHERE cp.payment_status='paid'
        AND (
          cp.metadata->>'complaint_id' = _complaint_id::text
          OR cp.case_id IN (SELECT id FROM public.cases WHERE related_complaint_id=_complaint_id)
        )
    )
$$;
GRANT EXECUTE ON FUNCTION public.complaint_payment_ready(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.confirm_complaint_receipt(p_receipt_id uuid, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.payment_receipts;
  v_complaint_id uuid;
  v_table text;
  v_status text;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_staff s WHERE s.user_id=p_actor) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO v_receipt FROM public.payment_receipts WHERE id=p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found'; END IF;
  IF v_receipt.payment_type NOT IN ('complaint_fee','student_complaint_fee','filing_fee') THEN
    RAISE EXCEPTION 'This receipt is not a complaint payment';
  END IF;

  SELECT COALESCE(
    (SELECT related_complaint_id FROM public.escrow_transactions WHERE id=v_receipt.escrow_transaction_id),
    (SELECT related_complaint_id FROM public.cases WHERE id=v_receipt.case_id),
    (SELECT (metadata->>'complaint_id')::uuid FROM public.case_payments
      WHERE payment_reference IN (v_receipt.platform_reference,v_receipt.paystack_reference)
        AND metadata ? 'complaint_id' LIMIT 1)
  ) INTO v_complaint_id;
  IF v_complaint_id IS NULL THEN RAISE EXCEPTION 'Receipt is not linked to a complaint'; END IF;

  UPDATE public.payment_receipts
    SET admin_confirmed_at=COALESCE(admin_confirmed_at,now()),
        admin_confirmed_by=COALESCE(admin_confirmed_by,p_actor)
    WHERE id=p_receipt_id;

  UPDATE public.complaints
    SET payment_status='paid',
        status=CASE WHEN status IN ('submitted','awaiting_payment','pending_payment') THEN 'ready_for_scheduling' ELSE status END,
        receipt_id=p_receipt_id,
        filing_fee_paid=true,
        filing_fee_paid_at=COALESCE(filing_fee_paid_at,now())
    WHERE id=v_complaint_id RETURNING status INTO v_status;
  IF FOUND THEN
    v_table:='complaints';
  ELSE
    UPDATE public.landlord_complaints
      SET payment_status='paid',
          status=CASE WHEN status IN ('submitted','awaiting_payment','pending_payment') THEN 'ready_for_scheduling' ELSE status END,
          receipt_id=p_receipt_id,
          filing_fee_paid=true,
          filing_fee_paid_at=COALESCE(filing_fee_paid_at,now())
      WHERE id=v_complaint_id RETURNING status INTO v_status;
    IF NOT FOUND THEN RAISE EXCEPTION 'Linked complaint not found'; END IF;
    v_table:='landlord_complaints';
  END IF;

  UPDATE public.case_payments
    SET payment_status='paid',
        reconciliation_status='reconciled',
        receipt_number=COALESCE(receipt_number,v_receipt.receipt_number),
        paid_at=COALESCE(paid_at,v_receipt.payment_date,now())
    WHERE case_id=v_receipt.case_id
       OR payment_reference IN (v_receipt.platform_reference,v_receipt.paystack_reference)
       OR metadata->>'complaint_id'=v_complaint_id::text;

  RETURN jsonb_build_object('ok',true,'complaint_id',v_complaint_id,'complaint_table',v_table,'status',v_status);
END
$$;

UPDATE public.admin_staff
SET scope_type='ALL_REGIONS', region_id=NULL, office_ids='{}'::text[]
WHERE admin_type IN ('main_admin','super_admin');

UPDATE public.admin_staff
SET scope_type='SPECIFIC_OFFICES', office_ids=ARRAY[office_id]
WHERE admin_type NOT IN ('main_admin','super_admin') AND office_id IS NOT NULL AND cardinality(office_ids)=0;