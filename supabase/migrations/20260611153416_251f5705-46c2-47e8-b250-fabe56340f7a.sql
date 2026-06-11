
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS billing_override text CHECK (billing_override IN ('free','custom_price')) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS billing_override_price_ghs numeric(12,2),
  ADD COLUMN IF NOT EXISTS pinned_version text,
  ADD COLUMN IF NOT EXISTS allowed_origins text[],
  ADD COLUMN IF NOT EXISTS previous_key_hash text,
  ADD COLUMN IF NOT EXISTS previous_key_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS dsa_version_accepted text,
  ADD COLUMN IF NOT EXISTS current_plan_id uuid;

CREATE TABLE IF NOT EXISTS public.api_pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_ghs numeric(12,2) NOT NULL DEFAULT 0,
  included_calls integer NOT NULL DEFAULT 0,
  overage_price_ghs_per_1k numeric(12,4),
  rate_limit_per_minute integer NOT NULL DEFAULT 60,
  allowed_scopes text[] NOT NULL DEFAULT '{}',
  webhook_endpoints_max integer NOT NULL DEFAULT 0,
  environment_access text NOT NULL DEFAULT 'sandbox' CHECK (environment_access IN ('sandbox','live','both')),
  is_active boolean NOT NULL DEFAULT true,
  is_public boolean NOT NULL DEFAULT true,
  is_enterprise boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  paystack_plan_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_pricing_plans TO anon, authenticated;
GRANT ALL ON public.api_pricing_plans TO service_role;
ALTER TABLE public.api_pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read public plans" ON public.api_pricing_plans
  FOR SELECT USING (is_public = true AND is_active = true);
CREATE POLICY "Admins manage plans" ON public.api_pricing_plans
  FOR ALL USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.api_pricing_plans(id),
  status text NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing','active','past_due','canceled','paused')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  paystack_customer_code text,
  paystack_subscription_code text,
  paystack_authorization_code text,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_subs_key ON public.api_subscriptions(api_key_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_subs_active_per_key
  ON public.api_subscriptions(api_key_id) WHERE status IN ('trialing','active','past_due');
GRANT SELECT ON public.api_subscriptions TO authenticated;
GRANT ALL ON public.api_subscriptions TO service_role;
ALTER TABLE public.api_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subscriptions" ON public.api_subscriptions
  FOR ALL USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  calls_count integer NOT NULL DEFAULT 0,
  overage_calls integer NOT NULL DEFAULT 0,
  overage_amount_ghs numeric(12,2) NOT NULL DEFAULT 0,
  last_call_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_key_period
  ON public.api_usage_counters(api_key_id, period_start);
GRANT SELECT ON public.api_usage_counters TO authenticated;
GRANT ALL ON public.api_usage_counters TO service_role;
ALTER TABLE public.api_usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read usage" ON public.api_usage_counters
  FOR SELECT USING (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES public.api_subscriptions(id) ON DELETE SET NULL,
  invoice_number text NOT NULL UNIQUE DEFAULT ('INV-API-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text, 1, 6)),
  amount_ghs numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','void')),
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  paystack_reference text,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_invoices_key ON public.api_invoices(api_key_id);
GRANT SELECT ON public.api_invoices TO authenticated;
GRANT ALL ON public.api_invoices TO service_role;
ALTER TABLE public.api_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invoices" ON public.api_invoices
  FOR ALL USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled','failing')),
  description text,
  last_delivery_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_key ON public.api_webhook_endpoints(api_key_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_webhook_endpoints TO authenticated;
GRANT ALL ON public.api_webhook_endpoints TO service_role;
ALTER TABLE public.api_webhook_endpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage webhook endpoints" ON public.api_webhook_endpoints
  FOR ALL USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id uuid NOT NULL REFERENCES public.api_webhook_endpoints(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','exhausted')),
  attempt integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  response_status integer,
  response_body text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_pending
  ON public.api_webhook_deliveries(next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_endpoint
  ON public.api_webhook_deliveries(endpoint_id, created_at DESC);
GRANT SELECT ON public.api_webhook_deliveries TO authenticated;
GRANT ALL ON public.api_webhook_deliveries TO service_role;
ALTER TABLE public.api_webhook_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read deliveries" ON public.api_webhook_deliveries
  FOR SELECT USING (public.is_main_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL,
  request_hash text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_idemp_key_unique
  ON public.api_idempotency_keys(api_key_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_idemp_expires ON public.api_idempotency_keys(expires_at);
GRANT ALL ON public.api_idempotency_keys TO service_role;
ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.api_dsa_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  title text NOT NULL,
  body_markdown text NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  effective_from timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.api_dsa_versions TO anon, authenticated;
GRANT ALL ON public.api_dsa_versions TO service_role;
ALTER TABLE public.api_dsa_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read DSA" ON public.api_dsa_versions FOR SELECT USING (true);
CREATE POLICY "Admins manage DSA" ON public.api_dsa_versions
  FOR ALL USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

INSERT INTO public.platform_config (config_key, config_value, description)
VALUES (
  'agency_api_billing_enabled',
  jsonb_build_object('enabled', false),
  'Master switch for Agency API monetization. When false, all keys run free with no metering enforcement.'
)
ON CONFLICT (config_key) DO NOTHING;

INSERT INTO public.api_pricing_plans (name, slug, description, price_ghs, included_calls, overage_price_ghs_per_1k, rate_limit_per_minute, allowed_scopes, webhook_endpoints_max, environment_access, is_public, is_enterprise, sort_order)
VALUES
  ('Free','free','Try the API with sandbox data. No live records.', 0, 1000, NULL, 30,
    ARRAY['stats:read'], 1, 'sandbox', true, false, 10),
  ('Starter','starter','For small integrations needing live read access.', 500, 50000, NULL, 60,
    ARRAY['stats:read','properties:read','complaints:read'], 2, 'live', true, false, 20),
  ('Growth','growth','For agencies needing broader read access and overage.', 2500, 500000, 0.5000, 300,
    ARRAY['stats:read','properties:read','complaints:read','landlords:read','tenants:read','tax:read'], 5, 'both', true, false, 30),
  ('Enterprise','enterprise','Custom pricing, SLAs, identity:read access, dedicated support.', 0, 0, NULL, 1000,
    ARRAY['stats:read','properties:read','complaints:read','landlords:read','tenants:read','tax:read','identity:read'], 20, 'both', true, true, 40)
ON CONFLICT (slug) DO NOTHING;

CREATE TRIGGER trg_api_plans_updated BEFORE UPDATE ON public.api_pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_api_subs_updated BEFORE UPDATE ON public.api_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_api_usage_updated BEFORE UPDATE ON public.api_usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_api_invoices_updated BEFORE UPDATE ON public.api_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_api_webhook_endpoints_updated BEFORE UPDATE ON public.api_webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_api_webhook_deliveries_updated BEFORE UPDATE ON public.api_webhook_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.api_increment_usage(
  p_api_key_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_included_calls integer,
  p_overage_price_per_1k numeric
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row api_usage_counters;
  v_over integer := 0;
  v_amt numeric := 0;
BEGIN
  INSERT INTO api_usage_counters (api_key_id, period_start, period_end, calls_count, last_call_at)
  VALUES (p_api_key_id, p_period_start, p_period_end, 1, now())
  ON CONFLICT (api_key_id, period_start)
  DO UPDATE SET calls_count = api_usage_counters.calls_count + 1, last_call_at = now()
  RETURNING * INTO v_row;

  IF v_row.calls_count > p_included_calls THEN
    v_over := v_row.calls_count - p_included_calls;
    IF p_overage_price_per_1k IS NOT NULL THEN
      v_amt := ROUND((v_over::numeric / 1000.0) * p_overage_price_per_1k, 2);
      UPDATE api_usage_counters
      SET overage_calls = v_over, overage_amount_ghs = v_amt
      WHERE id = v_row.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'calls_count', v_row.calls_count,
    'included', p_included_calls,
    'overage', v_over,
    'overage_billable', p_overage_price_per_1k IS NOT NULL,
    'over_quota', v_row.calls_count > p_included_calls
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.api_increment_usage TO service_role;

CREATE OR REPLACE FUNCTION public.api_enqueue_webhook_event(
  p_event_type text,
  p_payload jsonb
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_ep record;
BEGIN
  FOR v_ep IN
    SELECT id FROM api_webhook_endpoints
    WHERE status = 'active' AND p_event_type = ANY(events)
  LOOP
    INSERT INTO api_webhook_deliveries (endpoint_id, event_type, payload, next_retry_at)
    VALUES (v_ep.id, p_event_type, p_payload, now());
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.api_enqueue_webhook_event TO service_role, authenticated;
