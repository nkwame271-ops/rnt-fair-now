ALTER FUNCTION public.admin_can_access_office(uuid,text) SECURITY INVOKER;
ALTER FUNCTION public.complaint_payment_ready(uuid) SECURITY INVOKER;
REVOKE ALL ON FUNCTION public.confirm_complaint_receipt(uuid,uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_complaint_receipt(uuid,uuid) TO service_role;