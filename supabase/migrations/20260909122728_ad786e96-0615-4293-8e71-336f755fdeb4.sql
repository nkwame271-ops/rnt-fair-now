-- 1. Set-based office scope helper (evaluated once per query, not once per row)
CREATE OR REPLACE FUNCTION public.admin_accessible_office_ids(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT CASE
        WHEN s.scope_type = 'ALL_REGIONS'
          THEN (SELECT array_agg(o.id) FROM public.offices o)
        WHEN s.scope_type = 'SPECIFIC_REGION_ALL_OFFICES'
          THEN (SELECT array_agg(o.id) FROM public.offices o WHERE o.region = s.region_id)
        WHEN s.scope_type = 'SPECIFIC_OFFICES'
          THEN s.office_ids
        ELSE NULL
      END
      FROM public.admin_staff s
      WHERE s.user_id = _user_id
      LIMIT 1
    ),
    ARRAY[]::text[]
  )
$function$;

GRANT EXECUTE ON FUNCTION public.admin_accessible_office_ids(uuid) TO authenticated, service_role;

-- 2. Rewrite the per-row policies to the set-based check
DROP POLICY IF EXISTS "Scoped staff view hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Scoped staff view hearing rooms" ON public.hearing_rooms
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read complaints" ON public.complaints;
CREATE POLICY "Scoped regulators read complaints" ON public.complaints
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators update complaints" ON public.complaints;
CREATE POLICY "Scoped regulators update complaints" ON public.complaints
FOR UPDATE TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators read landlord complaints" ON public.landlord_complaints
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators update landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators update landlord complaints" ON public.landlord_complaints
FOR UPDATE TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Scoped regulators read escrow transactions" ON public.escrow_transactions
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read receipts" ON public.payment_receipts;
CREATE POLICY "Scoped regulators read receipts" ON public.payment_receipts
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read tenants" ON public.tenants;
CREATE POLICY "Scoped regulators read tenants" ON public.tenants
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read landlords" ON public.landlords;
CREATE POLICY "Scoped regulators read landlords" ON public.landlords
FOR SELECT TO authenticated
USING (office_id = ANY (public.admin_accessible_office_ids(auth.uid())));

-- 3. Activity log index
CREATE INDEX IF NOT EXISTS idx_admin_activity_log_user_created
  ON public.admin_activity_log (user_id, created_at DESC);

-- 4. Statistics: refresh now and keep small reference tables analyzed aggressively
ALTER TABLE public.hearing_rooms SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 50);
ALTER TABLE public.offices SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 50);
ALTER TABLE public.admin_staff SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 50);
ALTER TABLE public.payment_receipts SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 50);
ALTER TABLE public.payout_transfers SET (autovacuum_analyze_scale_factor = 0.02, autovacuum_analyze_threshold = 50);

ANALYZE public.hearing_rooms;
ANALYZE public.offices;
ANALYZE public.admin_staff;
ANALYZE public.payment_receipts;
ANALYZE public.payout_transfers;
ANALYZE public.units;
ANALYZE public.tenants;
ANALYZE public.landlord_complaints;
ANALYZE public.complaints;
ANALYZE public.escrow_transactions;