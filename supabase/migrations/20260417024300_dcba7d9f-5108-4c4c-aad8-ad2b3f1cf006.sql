ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'individual';

DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_user_type_check
    CHECK (user_type IN ('individual','student','organization'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON public.profiles(user_type) WHERE user_type <> 'individual';
CREATE INDEX IF NOT EXISTS idx_complaints_office_id ON public.complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_landlord_complaints_office_id ON public.landlord_complaints(office_id);
CREATE INDEX IF NOT EXISTS idx_escrow_transactions_office_id ON public.escrow_transactions(office_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_user_id ON public.payment_receipts(user_id);