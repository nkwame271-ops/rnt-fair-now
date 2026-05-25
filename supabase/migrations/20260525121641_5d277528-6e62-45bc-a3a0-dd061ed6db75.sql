ALTER TABLE public.system_health_snapshots
  ADD COLUMN IF NOT EXISTS db_connections_used integer,
  ADD COLUMN IF NOT EXISTS db_connections_max integer,
  ADD COLUMN IF NOT EXISTS db_connections_pct integer;

CREATE OR REPLACE FUNCTION public.capture_system_health_snapshot()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_drift jsonb;
  v_dash_refreshed timestamptz;
  v_alert boolean;
  v_id uuid;
  v_conn_used int;
  v_conn_max int;
  v_conn_pct int;
BEGIN
  v_drift := public.detect_receipt_drift();
  SELECT max(refreshed_at) INTO v_dash_refreshed FROM public.mv_office_dashboard_stats;

  SELECT count(*) INTO v_conn_used FROM pg_stat_activity;
  SELECT setting::int INTO v_conn_max FROM pg_settings WHERE name='max_connections';
  v_conn_pct := CASE WHEN v_conn_max > 0 THEN (v_conn_used * 100) / v_conn_max ELSE 0 END;

  v_alert := COALESCE((v_drift->>'missing_receipts')::int, 0) > 0
          OR COALESCE((v_drift->>'missing_receipt_numbers')::int, 0) > 0
          OR COALESCE((v_drift->>'unreconciled')::int, 0) > 0
          OR COALESCE((v_drift->>'open_failures_24h')::int, 0) > 0
          OR v_conn_pct >= 70;

  INSERT INTO public.system_health_snapshots (
    missing_receipts, missing_receipt_numbers, unreconciled, open_failures_24h,
    dashboard_refreshed_at, dashboard_stale_seconds, alert, details,
    db_connections_used, db_connections_max, db_connections_pct
  ) VALUES (
    COALESCE((v_drift->>'missing_receipts')::int, 0),
    COALESCE((v_drift->>'missing_receipt_numbers')::int, 0),
    COALESCE((v_drift->>'unreconciled')::int, 0),
    COALESCE((v_drift->>'open_failures_24h')::int, 0),
    v_dash_refreshed,
    CASE WHEN v_dash_refreshed IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_dash_refreshed))::int END,
    v_alert,
    v_drift,
    v_conn_used,
    v_conn_max,
    v_conn_pct
  ) RETURNING id INTO v_id;

  DELETE FROM public.system_health_snapshots WHERE captured_at < now() - interval '30 days';

  RETURN v_id;
END;
$$;