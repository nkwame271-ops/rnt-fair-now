
ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS filing_fee_paid_at timestamp with time zone;
