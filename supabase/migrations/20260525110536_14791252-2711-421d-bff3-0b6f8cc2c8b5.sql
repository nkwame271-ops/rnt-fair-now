
CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  missing_receipts int NOT NULL DEFAULT 0,
  missing_receipt_numbers int NOT NULL DEFAULT 0,
  unreconciled int NOT NULL DEFAULT 0,
  open_failures_24h int NOT NULL DEFAULT 0,
  dashboard_refreshed_at timestamptz,
  dashboard_stale_seconds int,
  alert boolean NOT NULL DEFAULT false,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_health_captured ON public.system_health_snapshots (captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_health_alert ON public.system_health_snapshots (alert, captured_at DESC) WHERE alert = true;

ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin staff can read system health" ON public.system_health_snapshots;
CREATE POLICY "Admin staff can read system health"
  ON public.system_health_snapshots
  FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id = auth.uid()));

-- Capture function
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
BEGIN
  v_drift := public.detect_receipt_drift();
  SELECT max(refreshed_at) INTO v_dash_refreshed FROM public.mv_office_dashboard_stats;

  v_alert := COALESCE((v_drift->>'missing_receipts')::int, 0) > 0
          OR COALESCE((v_drift->>'missing_receipt_numbers')::int, 0) > 0
          OR COALESCE((v_drift->>'unreconciled')::int, 0) > 0
          OR COALESCE((v_drift->>'open_failures_24h')::int, 0) > 0;

  INSERT INTO public.system_health_snapshots (
    missing_receipts, missing_receipt_numbers, unreconciled, open_failures_24h,
    dashboard_refreshed_at, dashboard_stale_seconds, alert, details
  ) VALUES (
    COALESCE((v_drift->>'missing_receipts')::int, 0),
    COALESCE((v_drift->>'missing_receipt_numbers')::int, 0),
    COALESCE((v_drift->>'unreconciled')::int, 0),
    COALESCE((v_drift->>'open_failures_24h')::int, 0),
    v_dash_refreshed,
    CASE WHEN v_dash_refreshed IS NOT NULL THEN EXTRACT(EPOCH FROM (now() - v_dash_refreshed))::int END,
    v_alert,
    v_drift
  ) RETURNING id INTO v_id;

  -- Garbage-collect older than 30 days
  DELETE FROM public.system_health_snapshots WHERE captured_at < now() - interval '30 days';

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.capture_system_health_snapshot() TO authenticated;

-- Prime one snapshot
SELECT public.capture_system_health_snapshot();

-- Schedule every 15 minutes
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('capture-system-health')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'capture-system-health');
    PERFORM cron.schedule(
      'capture-system-health',
      '*/15 * * * *',
      $cron$ SELECT public.capture_system_health_snapshot(); $cron$
    );
  END IF;
END $$;
