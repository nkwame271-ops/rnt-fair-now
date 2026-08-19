CREATE UNIQUE INDEX IF NOT EXISTS cashbook_entries_source_receipt_unique ON public.cashbook_entries (source_receipt_id) WHERE source_receipt_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.post_receipt_to_cashbook() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ref text; v_prev_balance numeric(14,2); v_amount numeric(14,2);
BEGIN
 IF NEW.status NOT IN ('completed','paid','issued','active') THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM public.cashbook_entries WHERE source_receipt_id=NEW.id) THEN RETURN NEW; END IF;
 v_ref:=COALESCE(NEW.paystack_reference,NEW.platform_reference,NEW.receipt_number,NEW.id::text); v_amount:=COALESCE(NEW.total_amount,0);
 SELECT running_balance INTO v_prev_balance FROM public.cashbook_entries ORDER BY entry_date DESC,created_at DESC LIMIT 1;
 INSERT INTO public.cashbook_entries(entry_date,receipt_no,payment_ref,description,category,payer,office,channel,method,money_in,money_out,running_balance,reconciliation_status,source_receipt_id,metadata)
 VALUES(COALESCE(NEW.payment_date,NEW.reconciliation_date,NEW.created_at,now()),NEW.receipt_number,v_ref,COALESCE(NEW.description,NEW.payment_type),COALESCE(NEW.service_type,NEW.payment_type,'other'),NEW.payer_name,NEW.office_id,'paystack',NEW.payment_method,v_amount,0,COALESCE(v_prev_balance,0)+v_amount,CASE WHEN NEW.reconciliation_date IS NOT NULL THEN 'reconciled' ELSE 'pending' END,NEW.id,jsonb_build_object('payment_type',NEW.payment_type,'service_type',NEW.service_type,'tenancy_id',NEW.tenancy_id,'case_id',NEW.case_id))
 ON CONFLICT (source_receipt_id) WHERE source_receipt_id IS NOT NULL DO NOTHING;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_post_receipt_to_cashbook ON public.payment_receipts;
CREATE TRIGGER trg_post_receipt_to_cashbook AFTER INSERT OR UPDATE OF status,total_amount,reconciliation_date ON public.payment_receipts FOR EACH ROW EXECUTE FUNCTION public.post_receipt_to_cashbook();

CREATE OR REPLACE FUNCTION public.confirm_complaint_receipt(p_receipt_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid:=auth.uid(); v_receipt public.payment_receipts; v_complaint_id uuid; v_table text; v_status text;
BEGIN
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_staff s WHERE s.user_id=v_actor) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT * INTO v_receipt FROM public.payment_receipts WHERE id=p_receipt_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Receipt not found'; END IF;
 IF v_receipt.payment_type NOT IN ('complaint_fee','student_complaint_fee') THEN RAISE EXCEPTION 'This receipt is not a complaint payment'; END IF;
 SELECT related_complaint_id INTO v_complaint_id FROM public.escrow_transactions WHERE id=v_receipt.escrow_transaction_id;
 IF v_complaint_id IS NULL THEN RAISE EXCEPTION 'Receipt is not linked to a complaint'; END IF;
 UPDATE public.payment_receipts SET admin_confirmed_at=COALESCE(admin_confirmed_at,now()),admin_confirmed_by=COALESCE(admin_confirmed_by,v_actor) WHERE id=p_receipt_id;
 UPDATE public.complaints SET payment_status='paid',status=CASE WHEN status IN ('submitted','awaiting_payment','pending_payment') THEN 'ready_for_scheduling' ELSE status END,receipt_id=p_receipt_id,filing_fee_paid=true,filing_fee_paid_at=COALESCE(filing_fee_paid_at,now()) WHERE id=v_complaint_id RETURNING status INTO v_status;
 IF FOUND THEN v_table:='complaints'; ELSE
  UPDATE public.landlord_complaints SET payment_status='paid',status=CASE WHEN status IN ('submitted','awaiting_payment','pending_payment') THEN 'ready_for_scheduling' ELSE status END,receipt_id=p_receipt_id,filing_fee_paid=true,filing_fee_paid_at=COALESCE(filing_fee_paid_at,now()) WHERE id=v_complaint_id RETURNING status INTO v_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'Linked complaint not found'; END IF; v_table:='landlord_complaints';
 END IF;
 UPDATE public.case_payments SET payment_status='paid',receipt_number=COALESCE(receipt_number,v_receipt.receipt_number),paid_at=COALESCE(paid_at,v_receipt.payment_date,now()) WHERE case_id=v_receipt.case_id OR payment_reference IN (v_receipt.platform_reference,v_receipt.paystack_reference);
 RETURN jsonb_build_object('ok',true,'complaint_id',v_complaint_id,'complaint_table',v_table,'status',v_status);
END $$;
REVOKE ALL ON FUNCTION public.confirm_complaint_receipt(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_complaint_receipt(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.payment_reconciliation_summary(p_office_id text,p_from timestamptz DEFAULT NULL,p_to timestamptz DEFAULT NULL)
RETURNS TABLE(payment_type text,transaction_count bigint,gross_total numeric,split_total numeric,receipt_total numeric,cashbook_total numeric,igf_office numeric,igf_hq numeric,admin_office numeric,admin_hq numeric,platform numeric,gra numeric,landlord numeric,viewer_is_super_admin boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_actor uuid:=auth.uid(); v_is_super boolean;
BEGIN
 SELECT EXISTS(SELECT 1 FROM public.admin_staff s WHERE s.user_id=v_actor AND s.admin_type='super_admin') INTO v_is_super;
 IF v_actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.admin_staff s WHERE s.user_id=v_actor) THEN RAISE EXCEPTION 'Not authorized'; END IF;
 RETURN QUERY WITH tx AS(
  SELECT et.id,et.payment_type,et.total_amount FROM public.escrow_transactions et WHERE et.status='completed' AND et.office_id=p_office_id AND et.payment_type NOT IN ('existing_tenancy_bundle','add_tenant_fee') AND (p_from IS NULL OR et.created_at>=p_from) AND (p_to IS NULL OR et.created_at<=p_to)
 ),sa AS(
  SELECT es.escrow_transaction_id,sum(es.amount) FILTER(WHERE es.status='active') split_total,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient IN ('rent_control','igf')) igf_office,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient='rent_control_hq') igf_hq,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient='admin') admin_office,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient='admin_hq') admin_hq,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient='platform') platform,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient='gra') gra,sum(es.amount) FILTER(WHERE es.status='active' AND es.recipient='landlord') landlord FROM public.escrow_splits es JOIN tx ON tx.id=es.escrow_transaction_id GROUP BY es.escrow_transaction_id
 ),ra AS(
  SELECT pr.escrow_transaction_id,sum(pr.total_amount) receipt_total,sum(CASE WHEN ce.id IS NOT NULL THEN ce.money_in ELSE 0 END) cashbook_total FROM public.payment_receipts pr JOIN tx ON tx.id=pr.escrow_transaction_id LEFT JOIN public.cashbook_entries ce ON ce.source_receipt_id=pr.id WHERE pr.status IN ('completed','paid','issued','active') GROUP BY pr.escrow_transaction_id
 ) SELECT tx.payment_type,count(*)::bigint,COALESCE(sum(tx.total_amount),0)::numeric,COALESCE(sum(sa.split_total),0)::numeric,COALESCE(sum(ra.receipt_total),0)::numeric,COALESCE(sum(ra.cashbook_total),0)::numeric,COALESCE(sum(sa.igf_office),0)::numeric,COALESCE(sum(sa.igf_hq),0)::numeric,COALESCE(sum(sa.admin_office),0)::numeric,COALESCE(sum(sa.admin_hq),0)::numeric,CASE WHEN v_is_super THEN COALESCE(sum(sa.platform),0)::numeric ELSE 0::numeric END,COALESCE(sum(sa.gra),0)::numeric,COALESCE(sum(sa.landlord),0)::numeric,v_is_super FROM tx LEFT JOIN sa ON sa.escrow_transaction_id=tx.id LEFT JOIN ra ON ra.escrow_transaction_id=tx.id GROUP BY tx.payment_type ORDER BY COALESCE(sum(tx.total_amount),0) DESC;
END $$;
REVOKE ALL ON FUNCTION public.payment_reconciliation_summary(text,timestamptz,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.payment_reconciliation_summary(text,timestamptz,timestamptz) TO authenticated,service_role;