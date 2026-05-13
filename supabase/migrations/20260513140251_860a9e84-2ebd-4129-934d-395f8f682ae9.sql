ALTER TABLE public.complaints DROP CONSTRAINT IF EXISTS complaints_status_check;
ALTER TABLE public.complaints ADD CONSTRAINT complaints_status_check
  CHECK (status = ANY (ARRAY[
    'submitted'::text,
    'awaiting_payment'::text,
    'pending_payment'::text,
    'under_review'::text,
    'in_progress'::text,
    'ready_for_scheduling'::text,
    'scheduled'::text,
    'schedule_complainant'::text,
    'resolved'::text,
    'closed'::text
  ]));

-- Repair the stuck complaint that failed to update due to the old constraint
UPDATE public.complaints
SET status='ready_for_scheduling',
    payment_status='paid',
    receipt_id=COALESCE(receipt_id, (SELECT id FROM public.payment_receipts WHERE escrow_transaction_id='07b1582b-957a-4c2a-80ef-3e2da6a2c755' LIMIT 1)),
    outstanding_amount=0
WHERE id='f0daac82-9b37-4a39-94cd-657fa3a31d36';