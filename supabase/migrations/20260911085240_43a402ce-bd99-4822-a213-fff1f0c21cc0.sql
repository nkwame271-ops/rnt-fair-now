CREATE OR REPLACE FUNCTION public.admin_has_global_scope(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_staff s
    WHERE s.user_id = _user_id AND s.scope_type = 'ALL_REGIONS'
  )
$$;

GRANT EXECUTE ON FUNCTION public.admin_has_global_scope(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Scoped regulators read landlords" ON public.landlords;
CREATE POLICY "Scoped regulators read landlords" ON public.landlords FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators read tenants" ON public.tenants;
CREATE POLICY "Scoped regulators read tenants" ON public.tenants FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators read complaints" ON public.complaints;
CREATE POLICY "Scoped regulators read complaints" ON public.complaints FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators update complaints" ON public.complaints;
CREATE POLICY "Scoped regulators update complaints" ON public.complaints FOR UPDATE TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators read landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators read landlord complaints" ON public.landlord_complaints FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators update landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators update landlord complaints" ON public.landlord_complaints FOR UPDATE TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators read escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Scoped regulators read escrow transactions" ON public.escrow_transactions FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped regulators read receipts" ON public.payment_receipts;
CREATE POLICY "Scoped regulators read receipts" ON public.payment_receipts FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);

DROP POLICY IF EXISTS "Scoped staff view hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Scoped staff view hearing rooms" ON public.hearing_rooms FOR SELECT TO authenticated
USING (
  (office_id IS NULL AND (SELECT public.admin_has_global_scope(auth.uid())))
  OR (SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]
);