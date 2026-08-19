REVOKE ALL ON FUNCTION public.admin_can_access_office(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complaint_payment_ready(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_complaint_receipt(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_can_access_office(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complaint_payment_ready(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_complaint_receipt(uuid,uuid) TO authenticated, service_role;