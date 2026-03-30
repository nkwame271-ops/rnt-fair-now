ALTER TABLE public.tenancies DROP CONSTRAINT IF EXISTS tenancies_status_check;
ALTER TABLE public.tenancies ADD CONSTRAINT tenancies_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'active', 'completed', 'terminated', 'disputed',
    'rejected', 'renewal_window', 'existing_declared',
    'awaiting_verification', 'verified_existing', 'expired'
  ]));