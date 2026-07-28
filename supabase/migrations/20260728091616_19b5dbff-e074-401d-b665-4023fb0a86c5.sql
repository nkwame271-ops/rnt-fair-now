ALTER TABLE public.agent_applications
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS payment_reference text,
  ADD COLUMN IF NOT EXISTS payment_amount numeric;

CREATE INDEX IF NOT EXISTS idx_agent_apps_payment_ref ON public.agent_applications(payment_reference);