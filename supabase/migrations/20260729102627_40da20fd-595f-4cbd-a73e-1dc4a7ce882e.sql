REVOKE EXECUTE ON FUNCTION public.issue_car_case_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_complaint_case_number(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_premium_property_to_agent(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.regulator_set_agent_status(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_car_case_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_complaint_case_number(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.assign_premium_property_to_agent(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regulator_set_agent_status(uuid, text, text) TO authenticated, service_role;