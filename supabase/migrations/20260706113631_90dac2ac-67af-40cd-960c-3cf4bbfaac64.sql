ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS payment_channel text,
  ADD COLUMN IF NOT EXISTS webhook_response jsonb;