CREATE OR REPLACE FUNCTION public.prune_admin_activity_log()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  DELETE FROM public.admin_activity_log WHERE created_at < now() - interval '90 days';
$function$;

REVOKE EXECUTE ON FUNCTION public.prune_admin_activity_log() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('prune-admin-activity-log', '20 3 * * *', $$SELECT public.prune_admin_activity_log();$$);