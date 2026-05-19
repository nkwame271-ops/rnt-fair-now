-- Filing fee gate for admin-filed complaints + paid lock on basket items
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS filing_fee_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filing_fee_paid_at timestamptz;

ALTER TABLE public.complaint_basket_items
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_complaints_filing_draft ON public.complaints(status) WHERE status = 'draft_awaiting_filing_payment';
CREATE INDEX IF NOT EXISTS idx_cbi_paid_at ON public.complaint_basket_items(complaint_table, complaint_id, paid_at);