CREATE SEQUENCE IF NOT EXISTS public.tenant_id_seq START WITH 100000 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.landlord_id_seq START WITH 100000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_tenant_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'TN-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.tenant_id_seq')::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_landlord_id()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'LL-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.landlord_id_seq')::text, 6, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_landlord_id() TO authenticated, service_role;