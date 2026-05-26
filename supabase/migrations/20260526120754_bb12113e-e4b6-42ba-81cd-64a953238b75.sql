CREATE INDEX IF NOT EXISTS idx_rcss_office_available
  ON public.rent_card_serial_stock (stock_type, office_name, region)
  WHERE status = 'available' AND (pair_index = 1 OR pair_index IS NULL);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_user_created
  ON public.admin_audit_log (admin_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON public.admin_audit_log (created_at DESC);

DROP INDEX IF EXISTS public.idx_notifications_user_unread;
CREATE INDEX idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_admin_activity_user_created
  ON public.admin_activity_log (user_id, created_at DESC);

ANALYZE public.rent_card_serial_stock;
ANALYZE public.admin_audit_log;
ANALYZE public.notifications;
ANALYZE public.admin_activity_log;