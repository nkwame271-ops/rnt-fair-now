CREATE OR REPLACE FUNCTION public.post_receipt_to_cashbook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref text;
  v_prev_balance numeric(14,2);
  v_amount numeric(14,2);
BEGIN
  IF NEW.status NOT IN ('completed','paid','issued','active') THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE source_receipt_id=NEW.id) THEN RETURN NEW; END IF;
  v_ref:=COALESCE(NEW.paystack_reference,NEW.platform_reference,NEW.receipt_number,NEW.id::text);

  UPDATE public.cashbook_entries
    SET source_receipt_id=NEW.id,
        receipt_no=COALESCE(receipt_no,NEW.receipt_number),
        metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object('payment_type',NEW.payment_type,'service_type',NEW.service_type,'tenancy_id',NEW.tenancy_id,'case_id',NEW.case_id)
    WHERE payment_ref=v_ref AND source_receipt_id IS NULL;
  IF FOUND THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE payment_ref=v_ref) THEN RETURN NEW; END IF;

  v_amount:=COALESCE(NEW.total_amount,0);
  SELECT running_balance INTO v_prev_balance FROM public.cashbook_entries ORDER BY entry_date DESC,created_at DESC LIMIT 1;
  INSERT INTO public.cashbook_entries(entry_date,receipt_no,payment_ref,description,category,payer,office,channel,method,money_in,money_out,running_balance,reconciliation_status,source_receipt_id,metadata)
  VALUES(COALESCE(NEW.payment_date,NEW.reconciliation_date,NEW.created_at,now()),NEW.receipt_number,v_ref,COALESCE(NEW.description,NEW.payment_type),COALESCE(NEW.service_type,NEW.payment_type,'other'),NEW.payer_name,NEW.office_id,'paystack',NEW.payment_method,v_amount,0,COALESCE(v_prev_balance,0)+v_amount,CASE WHEN NEW.reconciliation_date IS NOT NULL THEN 'reconciled' ELSE 'pending' END,NEW.id,jsonb_build_object('payment_type',NEW.payment_type,'service_type',NEW.service_type,'tenancy_id',NEW.tenancy_id,'case_id',NEW.case_id))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END
$$;