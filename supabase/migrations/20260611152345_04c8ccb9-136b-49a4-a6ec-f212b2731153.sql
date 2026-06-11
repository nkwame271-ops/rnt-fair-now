
-- 1. Extend api_keys
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS key_prefix text,
  ADD COLUMN IF NOT EXISTS agency_contact_email text,
  ADD COLUMN IF NOT EXISTS agency_contact_phone text,
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production',
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute int NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS allowed_ip_cidrs text[],
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_by uuid,
  ADD COLUMN IF NOT EXISTS revoke_reason text,
  ADD COLUMN IF NOT EXISTS last_used_ip inet,
  ADD COLUMN IF NOT EXISTS dsa_signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys (key_prefix);

-- 2. api_request_log
CREATE TABLE IF NOT EXISTS public.api_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  agency_name text,
  endpoint text NOT NULL,
  scope_used text,
  method text NOT NULL DEFAULT 'POST',
  status_code int NOT NULL,
  response_ms int,
  ip inet,
  user_agent text,
  request_params jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_request_log TO authenticated;
GRANT ALL ON public.api_request_log TO service_role;
ALTER TABLE public.api_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read api_request_log"
  ON public.api_request_log FOR SELECT TO authenticated
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Service role manages api_request_log"
  ON public.api_request_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_api_request_log_key_created
  ON public.api_request_log (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_request_log_created
  ON public.api_request_log (created_at DESC);

-- 3. api_scopes catalogue
CREATE TABLE IF NOT EXISTS public.api_scopes (
  scope_key text PRIMARY KEY,
  label text NOT NULL,
  description text,
  category text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.api_scopes TO authenticated, anon;
GRANT ALL ON public.api_scopes TO service_role;
ALTER TABLE public.api_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads api_scopes"
  ON public.api_scopes FOR SELECT TO authenticated, anon
  USING (true);

CREATE POLICY "Admins manage api_scopes"
  ON public.api_scopes FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid()))
  WITH CHECK (public.is_main_admin(auth.uid()));

INSERT INTO public.api_scopes (scope_key, label, description, category) VALUES
  ('landlords:read', 'Landlords (Read)', 'List and detail of registered landlords (PII masked).', 'landlord'),
  ('tenants:read', 'Tenants (Read)', 'List and detail of registered tenants (PII masked).', 'tenant'),
  ('properties:read', 'Properties (Read)', 'Property listings, vacancies, conditions, by region.', 'property'),
  ('complaints:read', 'Complaints (Read)', 'Complaint listings and summaries (anonymised by default).', 'complaint'),
  ('stats:read', 'Statistics (Read)', 'Aggregated platform statistics and regional breakdowns.', 'stats'),
  ('identity:read', 'Identity (Read)', 'KYC statistics and Ghana Card usage. Requires signed DSA.', 'identity'),
  ('tax:read', 'Tax (Read)', 'Landlord income and rent-tax collected aggregates.', 'tax')
ON CONFLICT (scope_key) DO NOTHING;

-- 4. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_request_log;
