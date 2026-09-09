CREATE OR REPLACE FUNCTION public.admin_accessible_office_ids(_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  result text[];
BEGIN
  SELECT scope_type, region_id, office_ids INTO s
  FROM public.admin_staff WHERE user_id = _user_id LIMIT 1;

  IF NOT FOUND OR s.scope_type IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;

  IF s.scope_type = 'SPECIFIC_OFFICES' THEN
    RETURN COALESCE(s.office_ids, ARRAY[]::text[]);
  ELSIF s.scope_type = 'SPECIFIC_REGION_ALL_OFFICES' THEN
    SELECT array_agg(o.id) INTO result FROM public.offices o WHERE o.region = s.region_id;
    RETURN COALESCE(result, ARRAY[]::text[]);
  ELSIF s.scope_type = 'ALL_REGIONS' THEN
    SELECT array_agg(o.id) INTO result FROM public.offices o;
    RETURN COALESCE(result, ARRAY[]::text[]);
  END IF;

  RETURN ARRAY[]::text[];
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_offices_region ON public.offices (region);