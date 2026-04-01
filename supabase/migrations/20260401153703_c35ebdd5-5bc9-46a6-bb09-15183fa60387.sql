ALTER TABLE public.system_settlement_accounts
  ADD COLUMN IF NOT EXISTS paystack_subaccount_code text;