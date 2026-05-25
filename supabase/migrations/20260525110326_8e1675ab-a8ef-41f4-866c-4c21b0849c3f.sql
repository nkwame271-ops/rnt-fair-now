
-- ============================================================
-- Phase 3.1 — Composite indexes for hot read paths
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_complaints_office_status ON public.complaints (office_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_status ON public.complaints (tenant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints (status);

CREATE INDEX IF NOT EXISTS idx_tenancies_office_status ON public.tenancies (office_id, status);
CREATE INDEX IF NOT EXISTS idx_tenancies_landlord_status ON public.tenancies (landlord_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tenancies_tenant_status ON public.tenancies (tenant_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tenancies_end_date ON public.tenancies (end_date) WHERE status IN ('active','renewal_window');

CREATE INDEX IF NOT EXISTS idx_properties_office ON public.properties (office_id);
CREATE INDEX IF NOT EXISTS idx_properties_landlord ON public.properties (landlord_user_id);
CREATE INDEX IF NOT EXISTS idx_properties_status_listed ON public.properties (property_status, listed_on_marketplace);

CREATE INDEX IF NOT EXISTS idx_termination_status ON public.termination_applications (status);
CREATE INDEX IF NOT EXISTS idx_side_payment_status ON public.side_payment_declarations (status);

CREATE INDEX IF NOT EXISTS idx_escrow_user_created ON public.escrow_transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_status_created ON public.escrow_transactions (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_reference ON public.escrow_transactions (reference);

CREATE INDEX IF NOT EXISTS idx_case_payments_status_paid ON public.case_payments (payment_status, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_case_payments_reference ON public.case_payments (payment_reference);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rent_cards_landlord_status ON public.rent_cards (landlord_user_id, status);
CREATE INDEX IF NOT EXISTS idx_rent_cards_tenancy ON public.rent_cards (tenancy_id);
CREATE INDEX IF NOT EXISTS idx_rent_cards_serial ON public.rent_cards (serial_number);

CREATE INDEX IF NOT EXISTS idx_units_property_status ON public.units (property_id, status);

-- ============================================================
-- Phase 3.2 — Cached dashboard stats (materialized views)
-- ============================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_office_dashboard_stats;
CREATE MATERIALIZED VIEW public.mv_office_dashboard_stats AS
SELECT
  o.id AS office_id,
  COALESCE((SELECT count(*) FROM public.properties p WHERE p.office_id = o.id), 0) AS total_properties,
  COALESCE((SELECT count(*) FROM public.complaints c WHERE c.office_id = o.id), 0) AS total_complaints,
  COALESCE((SELECT count(*) FROM public.complaints c WHERE c.office_id = o.id AND c.status IN ('submitted','under_review')), 0) AS pending_complaints,
  COALESCE((SELECT count(*) FROM public.tenancies t WHERE t.office_id = o.id AND t.status = 'active'), 0) AS active_tenancies,
  now() AS refreshed_at
FROM public.offices o;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_office_dashboard_stats_office
  ON public.mv_office_dashboard_stats (office_id);

DROP MATERIALIZED VIEW IF EXISTS public.mv_global_dashboard_stats;
CREATE MATERIALIZED VIEW public.mv_global_dashboard_stats AS
SELECT
  1 AS singleton,
  COALESCE((SELECT count(*) FROM public.tenants), 0) AS total_tenants,
  COALESCE((SELECT count(*) FROM public.landlords), 0) AS total_landlords,
  COALESCE((SELECT count(*) FROM public.properties), 0) AS total_properties,
  COALESCE((SELECT count(*) FROM public.complaints), 0) AS total_complaints,
  COALESCE((SELECT count(*) FROM public.complaints WHERE status IN ('submitted','under_review')), 0) AS pending_complaints,
  COALESCE((SELECT count(*) FROM public.tenancies WHERE status = 'active'), 0) AS active_tenancies,
  COALESCE((SELECT count(*) FROM public.termination_applications WHERE status IN ('pending','under_review','mediation')), 0) AS pending_terminations,
  COALESCE((SELECT count(*) FROM public.side_payment_declarations WHERE status IN ('reported','under_investigation')), 0) AS reported_side_payments,
  now() AS refreshed_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_global_dashboard_stats_singleton
  ON public.mv_global_dashboard_stats (singleton);

-- Refresh helper
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_office_dashboard_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_global_dashboard_stats;
EXCEPTION WHEN OTHERS THEN
  -- First refresh after create may need non-concurrent; fall back
  REFRESH MATERIALIZED VIEW public.mv_office_dashboard_stats;
  REFRESH MATERIALIZED VIEW public.mv_global_dashboard_stats;
END;
$$;

-- Prime the views once
SELECT public.refresh_dashboard_stats();

-- Reader RPC — only admin staff can call
CREATE OR REPLACE FUNCTION public.get_regulator_dashboard_stats(p_office_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_global record;
  v_office record;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_global FROM public.mv_global_dashboard_stats LIMIT 1;

  IF p_office_id IS NULL OR p_office_id = 'all' THEN
    RETURN jsonb_build_object(
      'scope', 'global',
      'total_tenants', v_global.total_tenants,
      'total_landlords', v_global.total_landlords,
      'total_properties', v_global.total_properties,
      'total_complaints', v_global.total_complaints,
      'pending_complaints', v_global.pending_complaints,
      'active_tenancies', v_global.active_tenancies,
      'pending_terminations', v_global.pending_terminations,
      'reported_side_payments', v_global.reported_side_payments,
      'refreshed_at', v_global.refreshed_at
    );
  END IF;

  SELECT * INTO v_office FROM public.mv_office_dashboard_stats WHERE office_id = p_office_id;

  RETURN jsonb_build_object(
    'scope', 'office',
    'office_id', p_office_id,
    'total_tenants', v_global.total_tenants,
    'total_landlords', v_global.total_landlords,
    'total_properties', COALESCE(v_office.total_properties, 0),
    'total_complaints', COALESCE(v_office.total_complaints, 0),
    'pending_complaints', COALESCE(v_office.pending_complaints, 0),
    'active_tenancies', COALESCE(v_office.active_tenancies, 0),
    'pending_terminations', v_global.pending_terminations,
    'reported_side_payments', v_global.reported_side_payments,
    'refreshed_at', COALESCE(v_office.refreshed_at, v_global.refreshed_at)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_regulator_dashboard_stats(text) TO authenticated;

-- Revoke direct MV access (force callers through the RPC)
REVOKE ALL ON public.mv_office_dashboard_stats FROM anon, authenticated;
REVOKE ALL ON public.mv_global_dashboard_stats FROM anon, authenticated;

-- ============================================================
-- Phase 3.3 — Schedule refresh every minute
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('refresh-dashboard-stats')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh-dashboard-stats');
    PERFORM cron.schedule(
      'refresh-dashboard-stats',
      '* * * * *',
      $cron$ SELECT public.refresh_dashboard_stats(); $cron$
    );
  END IF;
END $$;
