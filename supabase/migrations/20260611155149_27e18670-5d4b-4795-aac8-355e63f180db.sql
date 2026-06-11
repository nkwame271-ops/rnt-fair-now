
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend app_role enum with 'developer'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. developer_organizations
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.developer_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  contact_email text NOT NULL,
  contact_phone text,
  website_url text,
  agency_type text,
  intended_use_case text,
  dsa_version_accepted text,
  dsa_signed_at timestamptz,
  owner_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_organizations TO authenticated;
GRANT ALL ON public.developer_organizations TO service_role;

ALTER TABLE public.developer_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers can view their org"
  ON public.developer_organizations FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Developers can insert their org"
  ON public.developer_organizations FOR INSERT TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Developers can update their org"
  ON public.developer_organizations FOR UPDATE TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'regulator'))
  WITH CHECK (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Regulators can delete orgs"
  ON public.developer_organizations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. developer_org_members (kept simple for v1 — owner only)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.developer_org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.developer_organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role text NOT NULL DEFAULT 'owner' CHECK (member_role IN ('owner','admin','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.developer_org_members TO authenticated;
GRANT ALL ON public.developer_org_members TO service_role;

ALTER TABLE public.developer_org_members ENABLE ROW LEVEL SECURITY;

-- helper: is the calling user a member of this org?
CREATE OR REPLACE FUNCTION public.user_in_developer_org(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.developer_org_members
    WHERE org_id = _org_id AND user_id = _user_id
  );
$$;

CREATE POLICY "Members visible to their org and regulators"
  ON public.developer_org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.user_in_developer_org(org_id, auth.uid())
         OR public.has_role(auth.uid(), 'regulator'));

CREATE POLICY "Owners and regulators manage members"
  ON public.developer_org_members FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'regulator')
    OR EXISTS (
      SELECT 1 FROM public.developer_organizations o
      WHERE o.id = org_id AND o.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'regulator')
    OR EXISTS (
      SELECT 1 FROM public.developer_organizations o
      WHERE o.id = org_id AND o.owner_user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Link api_keys → developer_organizations
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.developer_organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON public.api_keys(organization_id);

-- Allow members of an org to SELECT their own keys (hash columns are stripped via the view below).
CREATE POLICY "Developers can view their own api_keys"
  ON public.api_keys FOR SELECT TO authenticated
  USING (
    organization_id IS NOT NULL
    AND public.user_in_developer_org(organization_id, auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Safe view for the developer portal (no hash columns)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.api_keys_developer_view AS
SELECT
  k.id,
  k.organization_id,
  k.agency_name,
  k.key_prefix,
  k.environment,
  k.scopes,
  k.is_active,
  k.revoked_at,
  k.revoke_reason,
  k.expires_at,
  k.last_used_at,
  k.last_used_ip,
  k.rate_limit_per_minute,
  k.allowed_ip_cidrs,
  k.dsa_signed_at,
  k.dsa_version_accepted,
  k.pinned_version,
  k.current_plan_id,
  k.billing_override,
  k.previous_key_expires_at,
  k.created_at
FROM public.api_keys k;

GRANT SELECT ON public.api_keys_developer_view TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. api_access_requests
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.api_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.developer_organizations(id) ON DELETE CASCADE,
  requested_environment text NOT NULL DEFAULT 'live'
    CHECK (requested_environment IN ('live','sandbox')),
  requested_scopes text[] NOT NULL DEFAULT '{}',
  intended_volume_monthly integer,
  agency_type text,
  justification text,
  contact_email text,
  contact_phone text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','changes_requested','approved','denied')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  issued_api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_access_requests_status ON public.api_access_requests(status);
CREATE INDEX IF NOT EXISTS idx_api_access_requests_org ON public.api_access_requests(org_id);

GRANT SELECT, INSERT, UPDATE ON public.api_access_requests TO authenticated;
GRANT ALL ON public.api_access_requests TO service_role;

ALTER TABLE public.api_access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers view their org requests"
  ON public.api_access_requests FOR SELECT TO authenticated
  USING (
    public.user_in_developer_org(org_id, auth.uid())
    OR public.has_role(auth.uid(), 'regulator')
  );

CREATE POLICY "Developers create requests for their org"
  ON public.api_access_requests FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.user_in_developer_org(org_id, auth.uid())
  );

CREATE POLICY "Regulators update requests"
  ON public.api_access_requests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'regulator'))
  WITH CHECK (public.has_role(auth.uid(), 'regulator'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_developer_organizations_updated_at ON public.developer_organizations;
CREATE TRIGGER trg_developer_organizations_updated_at
  BEFORE UPDATE ON public.developer_organizations
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_api_access_requests_updated_at ON public.api_access_requests;
CREATE TRIGGER trg_api_access_requests_updated_at
  BEFORE UPDATE ON public.api_access_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. RPC: provision a sandbox key for the signed-in user's org
--    Returns the plaintext key ONCE.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.developer_provision_sandbox_key()
RETURNS TABLE (api_key text, key_id uuid, key_prefix text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org  public.developer_organizations%ROWTYPE;
  v_existing uuid;
  v_random  text;
  v_full    text;
  v_prefix  text;
  v_hash    text;
  v_plan_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_org FROM public.developer_organizations
    WHERE owner_user_id = v_user LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No developer organization found for this user';
  END IF;

  -- Allow only one active sandbox key per org via this self-service path.
  SELECT id INTO v_existing FROM public.api_keys
    WHERE organization_id = v_org.id
      AND environment = 'sandbox'
      AND is_active = true
      AND revoked_at IS NULL
    LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'Sandbox key already exists. Rotate or revoke the existing key first.';
  END IF;

  -- Build a random 40-char body: rcg_test_<40 hex>
  v_random := encode(extensions.gen_random_bytes(20), 'hex');
  v_full   := 'rcg_test_' || v_random;
  v_prefix := substr(v_full, 1, 16);
  v_hash   := encode(extensions.digest(v_full, 'sha256'), 'hex');

  SELECT id INTO v_plan_id FROM public.api_pricing_plans WHERE slug = 'free' LIMIT 1;

  INSERT INTO public.api_keys (
    organization_id, agency_name, api_key_hash, key_prefix,
    scopes, environment, rate_limit_per_minute, is_active,
    agency_contact_email, current_plan_id, created_by
  ) VALUES (
    v_org.id, v_org.name, v_hash, v_prefix,
    ARRAY['landlords:read','tenants:read','properties:read','complaints:read','stats:read']::text[],
    'sandbox', 60, true,
    v_org.contact_email, v_plan_id, v_user
  ) RETURNING id INTO v_existing;

  RETURN QUERY SELECT v_full, v_existing, v_prefix;
END;
$$;

REVOKE ALL ON FUNCTION public.developer_provision_sandbox_key() FROM public;
GRANT EXECUTE ON FUNCTION public.developer_provision_sandbox_key() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. RPC: rotate a key the calling user owns
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.developer_rotate_api_key(p_key_id uuid)
RETURNS TABLE (api_key text, key_prefix text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_key  public.api_keys%ROWTYPE;
  v_random text;
  v_full   text;
  v_prefix text;
  v_hash   text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_key FROM public.api_keys WHERE id = p_key_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Key not found'; END IF;
  IF v_key.organization_id IS NULL
     OR NOT public.user_in_developer_org(v_key.organization_id, v_user) THEN
    RAISE EXCEPTION 'Not authorised to rotate this key';
  END IF;

  v_random := encode(extensions.gen_random_bytes(20), 'hex');
  v_full   := CASE WHEN v_key.environment = 'sandbox'
                   THEN 'rcg_test_' || v_random
                   ELSE 'rcg_live_' || v_random END;
  v_prefix := substr(v_full, 1, 16);
  v_hash   := encode(extensions.digest(v_full, 'sha256'), 'hex');

  UPDATE public.api_keys SET
    previous_key_hash = api_key_hash,
    previous_key_expires_at = now() + interval '24 hours',
    api_key_hash = v_hash,
    key_prefix   = v_prefix
  WHERE id = p_key_id;

  RETURN QUERY SELECT v_full, v_prefix;
END;
$$;

REVOKE ALL ON FUNCTION public.developer_rotate_api_key(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.developer_rotate_api_key(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. RPC: revoke own key
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.developer_revoke_api_key(p_key_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_key public.api_keys%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_key FROM public.api_keys WHERE id = p_key_id LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Key not found'; END IF;
  IF v_key.organization_id IS NULL
     OR NOT public.user_in_developer_org(v_key.organization_id, v_user) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.api_keys SET
    is_active = false,
    revoked_at = now(),
    revoked_by = v_user,
    revoke_reason = p_reason
  WHERE id = p_key_id;
END;
$$;

REVOKE ALL ON FUNCTION public.developer_revoke_api_key(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.developer_revoke_api_key(uuid, text) TO authenticated;
