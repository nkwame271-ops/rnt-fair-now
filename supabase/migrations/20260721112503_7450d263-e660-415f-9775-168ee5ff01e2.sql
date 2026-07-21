
CREATE TABLE IF NOT EXISTS public.pending_premium_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscriber_role text NOT NULL,
  property_id uuid,
  fee_amount numeric NOT NULL DEFAULT 0,
  billing_frequency text NOT NULL DEFAULT 'monthly',
  reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending_payment',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_premium_drafts TO authenticated;
GRANT ALL ON public.pending_premium_drafts TO service_role;
ALTER TABLE public.pending_premium_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own premium drafts" ON public.pending_premium_drafts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view premium drafts" ON public.pending_premium_drafts
  FOR SELECT USING (public.is_main_admin(auth.uid()));

ALTER TABLE public.premium_subscriptions
  ADD COLUMN IF NOT EXISTS fee_amount numeric,
  ADD COLUMN IF NOT EXISTS billing_frequency text DEFAULT 'monthly';

CREATE TRIGGER update_pending_premium_drafts_updated_at
  BEFORE UPDATE ON public.pending_premium_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
