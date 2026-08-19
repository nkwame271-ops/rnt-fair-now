-- Atomic complaint assignment and office-scope enforcement for core regulator records.
CREATE OR REPLACE FUNCTION public.assign_complaint_case(
  p_complaint_id uuid,
  p_complaint_table text,
  p_assigned_to uuid,
  p_room_id uuid,
  p_reason text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_current public.complaint_assignments;
  v_new_id uuid;
  v_office_id text;
BEGIN
  IF v_actor IS NULL OR NOT public.is_main_admin(v_actor) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_complaint_table NOT IN ('complaints','landlord_complaints') THEN RAISE EXCEPTION 'Invalid complaint table'; END IF;
  IF p_room_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.hearing_rooms WHERE id=p_room_id AND active) THEN RAISE EXCEPTION 'Select an active hearing room'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_staff WHERE user_id=p_assigned_to) THEN RAISE EXCEPTION 'Assignee is not active staff'; END IF;

  SELECT * INTO v_current FROM public.complaint_assignments
  WHERE complaint_id=p_complaint_id AND complaint_table=p_complaint_table AND unassigned_at IS NULL
  ORDER BY assigned_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Reason for reassignment is required'; END IF;
  IF FOUND THEN UPDATE public.complaint_assignments SET unassigned_at=now() WHERE id=v_current.id; END IF;

  INSERT INTO public.complaint_assignments(complaint_id,complaint_table,assigned_to,assigned_by,reason,room_id)
  VALUES(p_complaint_id,p_complaint_table,p_assigned_to,v_actor,COALESCE(nullif(trim(p_reason),''),'Initial assignment'),p_room_id)
  RETURNING id INTO v_new_id;

  INSERT INTO public.complaint_audit_log(case_id,case_kind,actor_id,action,old_value,new_value)
  VALUES(p_complaint_id,CASE WHEN p_complaint_table='complaints' THEN 'complaint' ELSE 'landlord_complaint' END,v_actor,
    CASE WHEN v_current.id IS NULL THEN 'case_assigned' ELSE 'case_reassigned' END,
    CASE WHEN v_current.id IS NULL THEN NULL ELSE jsonb_build_object('assigned_to',v_current.assigned_to,'room_id',v_current.room_id) END,
    jsonb_build_object('assigned_to',p_assigned_to,'room_id',p_room_id,'reason',COALESCE(nullif(trim(p_reason),''),'Initial assignment'),'assigned_by',v_actor,'assigned_at',now()));
  RETURN v_new_id;
END $$;
REVOKE ALL ON FUNCTION public.assign_complaint_case(uuid,text,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_complaint_case(uuid,text,uuid,uuid,text) TO authenticated, service_role;

-- Every office receives a real room source; both assignment and Command Center query this table.
INSERT INTO public.hearing_rooms(office_id,name,capacity,active)
SELECT o.id,'Hearing Room 1',10,true FROM public.offices o
WHERE NOT EXISTS (SELECT 1 FROM public.hearing_rooms h WHERE h.office_id=o.id AND h.active);

-- Make receipt identity idempotent at the database boundary.
CREATE UNIQUE INDEX IF NOT EXISTS payment_receipts_escrow_unique
ON public.payment_receipts(escrow_transaction_id) WHERE escrow_transaction_id IS NOT NULL AND receipt_status <> 'voided';

-- Prevent staff from altering their own scope or privilege through direct Data API updates.
DROP POLICY IF EXISTS "Main admins update admin_staff" ON public.admin_staff;
CREATE POLICY "Super admins update other staff" ON public.admin_staff FOR UPDATE TO authenticated
USING (public.is_super_admin(auth.uid()) AND user_id <> auth.uid())
WITH CHECK (public.is_super_admin(auth.uid()) AND user_id <> auth.uid());

-- Replace blanket regulator visibility with office-aware policies on the core requested modules.
DROP POLICY IF EXISTS "Regulators can read all landlords" ON public.landlords;
CREATE POLICY "Scoped regulators read landlords" ON public.landlords FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));
DROP POLICY IF EXISTS "Regulators can read all tenants" ON public.tenants;
CREATE POLICY "Scoped regulators read tenants" ON public.tenants FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));
DROP POLICY IF EXISTS "Regulators read all complaints" ON public.complaints;
DROP POLICY IF EXISTS "Regulators update complaints" ON public.complaints;
CREATE POLICY "Scoped regulators read complaints" ON public.complaints FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));
CREATE POLICY "Scoped regulators update complaints" ON public.complaints FOR UPDATE TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id)) WITH CHECK (public.admin_can_access_office(auth.uid(),office_id));
DROP POLICY IF EXISTS "Regulators read all landlord complaints" ON public.landlord_complaints;
DROP POLICY IF EXISTS "Regulators update landlord complaints" ON public.landlord_complaints;
CREATE POLICY "Scoped regulators read landlord complaints" ON public.landlord_complaints FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));
CREATE POLICY "Scoped regulators update landlord complaints" ON public.landlord_complaints FOR UPDATE TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id)) WITH CHECK (public.admin_can_access_office(auth.uid(),office_id));
DROP POLICY IF EXISTS "Regulators read all receipts" ON public.payment_receipts;
CREATE POLICY "Scoped regulators read receipts" ON public.payment_receipts FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));
DROP POLICY IF EXISTS "Regulators read all escrow transactions" ON public.escrow_transactions;
CREATE POLICY "Scoped regulators read escrow transactions" ON public.escrow_transactions FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));

-- Hearing rooms themselves obey the same scope.
DROP POLICY IF EXISTS "Admin staff view hearing rooms" ON public.hearing_rooms;
CREATE POLICY "Scoped staff view hearing rooms" ON public.hearing_rooms FOR SELECT TO authenticated
USING (public.admin_can_access_office(auth.uid(),office_id));
