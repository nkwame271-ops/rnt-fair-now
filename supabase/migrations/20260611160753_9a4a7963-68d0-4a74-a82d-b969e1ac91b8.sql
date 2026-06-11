
-- Track when developer was emailed about a decision so we don't duplicate
ALTER TABLE public.api_access_requests
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Seed master admin controls in platform_config (idempotent)
INSERT INTO public.platform_config (config_key, config_value, description)
VALUES
  ('developer_signups_paused', '{"paused": false}'::jsonb, 'When true, /developers/signup is disabled.'),
  ('developer_auto_sandbox', '{"enabled": true}'::jsonb, 'When true, sandbox keys are auto-issued on first login.'),
  ('developer_require_dsa_reaccept', '{"required": false}'::jsonb, 'When true, all orgs must re-accept DSA on next login.')
ON CONFLICT (config_key) DO NOTHING;
