
-- Create admin activity log table
CREATE TABLE public.admin_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_detail TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient querying
CREATE INDEX idx_admin_activity_log_user_id ON public.admin_activity_log (user_id);
CREATE INDEX idx_admin_activity_log_event_type ON public.admin_activity_log (event_type);
CREATE INDEX idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);

-- Enable RLS
ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own activity
CREATE POLICY "Users can insert own activity"
ON public.admin_activity_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Regulators (admins) can view all activity
CREATE POLICY "Regulators can view all activity"
ON public.admin_activity_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'regulator'));
