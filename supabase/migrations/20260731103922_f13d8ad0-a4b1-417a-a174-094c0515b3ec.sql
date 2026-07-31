
-- 1) Tenant visibility on rent cards
CREATE OR REPLACE FUNCTION public.is_tenant_of_tenancy(_tenancy_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenancies t
    WHERE t.id = _tenancy_id AND t.tenant_user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Tenants read own rent cards" ON public.rent_cards;
CREATE POLICY "Tenants read own rent cards"
ON public.rent_cards
FOR SELECT
TO authenticated
USING (
  tenant_user_id = auth.uid()
  OR (tenancy_id IS NOT NULL AND public.is_tenant_of_tenancy(tenancy_id, auth.uid()))
);

-- 2) Assigned agent profile lookup for premium subscribers
CREATE OR REPLACE FUNCTION public.get_assigned_agent_profile(_subscription_id uuid)
RETURNS TABLE(
  user_id uuid,
  agent_id text,
  full_name text,
  email text,
  phone text,
  professional_photo_url text,
  region text,
  operating_area text,
  status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent uuid;
BEGIN
  SELECT ps.assigned_agent_user_id INTO v_agent
  FROM public.premium_subscriptions ps
  WHERE ps.id = _subscription_id
    AND (
      ps.subscriber_user_id = auth.uid()
      OR ps.assigned_agent_user_id = auth.uid()
      OR public.is_main_admin(auth.uid())
      OR public.is_super_admin(auth.uid())
    );

  IF v_agent IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT a.user_id,
         upper(left(a.id::text, 8)) AS agent_id,
         a.full_name,
         a.email,
         a.phone,
         a.professional_photo_url,
         a.region,
         a.operating_area,
         a.status
  FROM public.agent_staff a
  WHERE a.user_id = v_agent;
END;
$$;

REVOKE ALL ON FUNCTION public.get_assigned_agent_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assigned_agent_profile(uuid) TO authenticated;

-- 3) Cashbook totals over ALL rows the caller may see (RLS-respecting)
CREATE OR REPLACE FUNCTION public.cashbook_totals(
  _from timestamptz DEFAULT NULL,
  _category text DEFAULT NULL,
  _office text DEFAULT NULL,
  _method text DEFAULT NULL,
  _rec_status text DEFAULT NULL,
  _search text DEFAULT NULL
)
RETURNS TABLE(
  entry_count bigint,
  money_in numeric,
  money_out numeric,
  reconciled numeric,
  pending numeric
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    count(*)::bigint,
    COALESCE(sum(c.money_in), 0),
    COALESCE(sum(c.money_out), 0),
    COALESCE(sum(CASE WHEN c.reconciliation_status = 'reconciled' THEN c.money_in ELSE 0 END), 0),
    COALESCE(sum(CASE WHEN c.reconciliation_status <> 'reconciled' THEN c.money_in ELSE 0 END), 0)
  FROM public.cashbook_entries c
  WHERE (_from IS NULL OR c.entry_date >= _from)
    AND (_category IS NULL OR c.category = _category)
    AND (_office IS NULL OR c.office = _office)
    AND (_method IS NULL OR COALESCE(c.method, 'unspecified') = _method)
    AND (_rec_status IS NULL OR c.reconciliation_status = _rec_status)
    AND (
      _search IS NULL OR _search = '' OR
      concat_ws(' ', c.receipt_no, c.payment_ref, c.description, c.payer, c.category) ILIKE '%' || _search || '%'
    )
$$;

REVOKE ALL ON FUNCTION public.cashbook_totals(timestamptz, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cashbook_totals(timestamptz, text, text, text, text, text) TO authenticated;
