SET LOCAL lock_timeout = '15s';

DROP POLICY IF EXISTS "Scoped staff view hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Scoped staff view hearing rooms" ON public.hearing_rooms
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Main admins manage hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Main admins manage hearing rooms" ON public.hearing_rooms
FOR ALL TO authenticated
USING ((SELECT public.is_main_admin(auth.uid())))
WITH CHECK ((SELECT public.is_main_admin(auth.uid())));

DROP POLICY IF EXISTS "Scoped regulators read complaints" ON public.complaints;
CREATE POLICY "Scoped regulators read complaints" ON public.complaints
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Scoped regulators update complaints" ON public.complaints;
CREATE POLICY "Scoped regulators update complaints" ON public.complaints
FOR UPDATE TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Scoped regulators read landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators read landlord complaints" ON public.landlord_complaints
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Scoped regulators update landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators update landlord complaints" ON public.landlord_complaints
FOR UPDATE TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Admin staff can update landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Admin staff can update landlord complaints" ON public.landlord_complaints
FOR UPDATE TO authenticated
USING ((SELECT public.is_main_admin(auth.uid())) OR (SELECT public.has_role(auth.uid(), 'regulator'::app_role)));

DROP POLICY IF EXISTS "Scoped regulators read escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Scoped regulators read escrow transactions" ON public.escrow_transactions
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Scoped regulators read receipts" ON public.payment_receipts;
CREATE POLICY "Scoped regulators read receipts" ON public.payment_receipts
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Scoped regulators read tenants" ON public.tenants;
CREATE POLICY "Scoped regulators read tenants" ON public.tenants
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Scoped regulators read landlords" ON public.landlords;
CREATE POLICY "Scoped regulators read landlords" ON public.landlords
FOR SELECT TO authenticated
USING ((SELECT public.admin_accessible_office_ids(auth.uid())) @> ARRAY[office_id]);

DROP POLICY IF EXISTS "Regulators read admin_staff" ON public.admin_staff;
CREATE POLICY "Regulators read admin_staff" ON public.admin_staff
FOR SELECT TO authenticated
USING ((SELECT public.has_role(auth.uid(), 'regulator'::app_role)));

DROP POLICY IF EXISTS "Regulators read non-student escrow splits" ON public.escrow_splits;
CREATE POLICY "Regulators read non-student escrow splits" ON public.escrow_splits
FOR SELECT TO authenticated
USING (
  (SELECT public.has_role(auth.uid(), 'regulator'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.escrow_transactions et
    WHERE et.id = escrow_splits.escrow_transaction_id AND et.is_student_revenue = false
  )
);