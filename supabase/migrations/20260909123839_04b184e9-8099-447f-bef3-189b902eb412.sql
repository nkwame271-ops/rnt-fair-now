SET LOCAL lock_timeout = '20s';

DO $$
DECLARE
  r record;
  ae text := '(COALESCE(NULLIF(current_setting(''request.jwt.claim.sub''::text, true), ''''::text), ((NULLIF(current_setting(''request.jwt.claims''::text, true), ''''::text))::jsonb ->> ''sub''::text)))::uuid';
  q text;
  c text;
  nq text;
  nc text;
  stmt text;
  fixed int := 0;
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( coalesce(qual,'') ~ '(has_role|is_main_admin|is_super_admin|admin_accessible_office_ids)\('
         OR coalesce(with_check,'') ~ '(has_role|is_main_admin|is_super_admin|admin_accessible_office_ids)\(' )
  LOOP
    q := r.qual;
    c := r.with_check;

    nq := q;
    nc := c;

    IF nq IS NOT NULL THEN
      nq := replace(nq, ae, 'auth.uid()');
      nq := regexp_replace(nq, 'has_role\(auth\.uid\(\), ''([a-z_]+)''::app_role\)', '(SELECT has_role(auth.uid(), ''\1''::app_role))', 'g');
      nq := regexp_replace(nq, '(?<!SELECT )\m(is_main_admin|is_super_admin|admin_accessible_office_ids)\(auth\.uid\(\)\)', '(SELECT \1(auth.uid()))', 'g');
    END IF;

    IF nc IS NOT NULL THEN
      nc := replace(nc, ae, 'auth.uid()');
      nc := regexp_replace(nc, 'has_role\(auth\.uid\(\), ''([a-z_]+)''::app_role\)', '(SELECT has_role(auth.uid(), ''\1''::app_role))', 'g');
      nc := regexp_replace(nc, '(?<!SELECT )\m(is_main_admin|is_super_admin|admin_accessible_office_ids)\(auth\.uid\(\)\)', '(SELECT \1(auth.uid()))', 'g');
    END IF;

    IF (nq IS DISTINCT FROM q) OR (nc IS DISTINCT FROM c) THEN
      stmt := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
      IF nq IS NOT NULL THEN stmt := stmt || format(' USING (%s)', nq); END IF;
      IF nc IS NOT NULL THEN stmt := stmt || format(' WITH CHECK (%s)', nc); END IF;
      EXECUTE stmt;
      fixed := fixed + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'rewrote % policies', fixed;
END $$;