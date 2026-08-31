-- 1. Office scope helper: SECURITY DEFINER so RLS is not re-entered per row
CREATE OR REPLACE FUNCTION public.admin_can_access_office(_user_id uuid, _office_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_staff s
    LEFT JOIN public.offices o ON o.id = _office_id
    WHERE s.user_id = _user_id
      AND (
        s.scope_type = 'ALL_REGIONS'
        OR (s.scope_type = 'SPECIFIC_REGION_ALL_OFFICES' AND o.region = s.region_id)
        OR (s.scope_type = 'SPECIFIC_OFFICES' AND _office_id = ANY(s.office_ids))
      )
  )
$function$;

-- 2. Missing indexes behind the slowest reads
CREATE INDEX IF NOT EXISTS idx_hearing_rooms_office_active
  ON public.hearing_rooms (office_id, active);

CREATE INDEX IF NOT EXISTS idx_rcss_region_type_status_pair
  ON public.rent_card_serial_stock (region, stock_type, status, pair_index, serial_number);

-- 3. Set-based lookup of escrow rows genuinely missing a receipt
CREATE OR REPLACE FUNCTION public.list_escrows_missing_receipts(p_limit int DEFAULT 100)
RETURNS TABLE (
  id uuid,
  reference text,
  total_amount numeric,
  paystack_transaction_id text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT et.id, et.reference, et.total_amount, et.paystack_transaction_id
  FROM public.escrow_transactions et
  WHERE et.status IN ('success','completed','paid')
    AND et.created_at < now() - interval '5 minutes'
    AND (et.metadata->>'parent_reference') IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.payment_receipts pr
      WHERE pr.escrow_transaction_id = et.id
    )
  ORDER BY et.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 500)
$function$;

REVOKE ALL ON FUNCTION public.list_escrows_missing_receipts(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.list_escrows_missing_receipts(int) TO service_role;

-- 4. Track failed scheduled jobs in the health snapshot
ALTER TABLE public.system_health_snapshots
  ADD COLUMN IF NOT EXISTS failed_cron_runs_1h int NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.capture_system_health_snapshot()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_drift jsonb;
  v_dash_refreshed timestamptz;
  v_alert boolean;
  v_id uuid;
  v_conn_used int;
  v_conn_max int;
  v_conn_pct int;
  v_failed_cron int := 0;
BEGIN
  v_drift := public.detect_receipt_drift();
  SELECT max(refreshed_at) INTO v_dash_refreshed FROM public.mv_office_dashboard_stats;

  SELECT count(*) INTO v_conn_used FROM pg_stat_activity;
  SELECT setting::int INTO v_conn_max FROM pg_settings WHERE name='max_connections';
  v_conn_pct := CASE WHEN v_conn_max > 0 THEN (v_conn_used * 100) / v_conn_max ELSE 0 END;

  BEGIN
    SELECT count(*) INTO v_failed_cron
    FROM cron.job_run_details
    WHERE status = 'failed'
      AND start_time > now() - interval '1 hour';
  EXCEPTION WHEN OTHERS THEN
    v_failed_cron := 0;
  END;

  v_alert := COALESCE((v_drift->>'missing_receipts')::int, 0) > 0
          OR COALESCE((v_drift->>'missing_receipt_numbers')::int, 0) > 0
          OR COALESCE((v_drift->>'unreconciled')::int, 0) > 0
          OR COALESCE((v_drift->>'open_failures_24h')::int, 0) > 0
          OR v_conn_pct >= 70
          OR v_failed_cron >= 3;

  INSERT INTO public.system_health_snapshots (
    missing_receipts, missing_receipt_numbers, unreconciled, open_failures_24h,
    dashboard_refreshed_at, dashboard_stale_seconds, alert, details,
    db_connections_used, db_connections_max, db_connections_pct, failed_cron_runs_1h
  ) VALUES (
    COALESCE((v_drift->>'missing_receipts')::int, 0),
    COALESCE((v_drift->>'missing_receipt_numbers')::int, 0),
    COALESCE((v_drift->>'unreconciled')::int, 0),
    COALESCE((v_drift->>'open_failures_24h')::int, 0),
    v_dash_refreshed,
    CASE WHEN v_dash_refreshed IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_dash_refreshed))::int END,
    v_alert,
    v_drift || jsonb_build_object('failed_cron_runs_1h', v_failed_cron),
    v_conn_used,
    v_conn_max,
    v_conn_pct,
    v_failed_cron
  ) RETURNING id INTO v_id;

  DELETE FROM public.system_health_snapshots WHERE captured_at < now() - interval '30 days';

  RETURN v_id;
END;
$function$;

-- 5. Skip dashboard cache refresh when it is already fresh
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_last timestamptz;
BEGIN
  SELECT max(refreshed_at) INTO v_last FROM public.mv_office_dashboard_stats;
  IF v_last IS NOT NULL AND v_last > now() - interval '4 minutes' THEN
    RETURN;
  END IF;

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_office_dashboard_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_global_dashboard_stats;
EXCEPTION WHEN OTHERS THEN
  REFRESH MATERIALIZED VIEW public.mv_office_dashboard_stats;
  REFRESH MATERIALIZED VIEW public.mv_global_dashboard_stats;
END;
$function$;