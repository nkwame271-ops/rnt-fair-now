CREATE TABLE IF NOT EXISTS public.sms_send_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  recipient_masked text NOT NULL,
  state text NOT NULL,
  failure_reason text,
  provider_message text,
  provider_message_id text,
  sender_used text,
  via text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sms_send_log_created_at_idx ON public.sms_send_log (created_at DESC);
CREATE INDEX IF NOT EXISTS sms_send_log_state_idx ON public.sms_send_log (state);

GRANT ALL ON public.sms_send_log TO service_role;
GRANT SELECT ON public.sms_send_log TO authenticated;

ALTER TABLE public.sms_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view SMS log" ON public.sms_send_log;
CREATE POLICY "Admins can view SMS log" ON public.sms_send_log
FOR SELECT TO authenticated
USING (public.is_main_admin(auth.uid()) OR public.has_role(auth.uid(), 'regulator'::app_role));