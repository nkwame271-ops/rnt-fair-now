
CREATE TABLE public.premium_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  subscriber_user_id UUID NOT NULL,
  subscriber_role TEXT NOT NULL CHECK (subscriber_role IN ('landlord','tenant')),
  assigned_agent_user_id UUID,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','cancelled')),
  yearly_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  management_enabled BOOLEAN NOT NULL DEFAULT true,
  payment_reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_premium_subs_property ON public.premium_subscriptions(property_id);
CREATE INDEX idx_premium_subs_subscriber ON public.premium_subscriptions(subscriber_user_id);
CREATE INDEX idx_premium_subs_agent ON public.premium_subscriptions(assigned_agent_user_id);
CREATE INDEX idx_premium_subs_status ON public.premium_subscriptions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.premium_subscriptions TO authenticated;
GRANT ALL ON public.premium_subscriptions TO service_role;

ALTER TABLE public.premium_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subscribers manage their own premium subscriptions"
  ON public.premium_subscriptions FOR ALL
  TO authenticated
  USING (subscriber_user_id = auth.uid())
  WITH CHECK (subscriber_user_id = auth.uid());

CREATE POLICY "Assigned agents can view their premium subscriptions"
  ON public.premium_subscriptions FOR SELECT
  TO authenticated
  USING (assigned_agent_user_id = auth.uid());

CREATE POLICY "Admins can view all premium subscriptions"
  ON public.premium_subscriptions FOR SELECT
  TO authenticated
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Admins can manage all premium subscriptions"
  ON public.premium_subscriptions FOR ALL
  TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TRIGGER trg_premium_subs_updated_at
  BEFORE UPDATE ON public.premium_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
