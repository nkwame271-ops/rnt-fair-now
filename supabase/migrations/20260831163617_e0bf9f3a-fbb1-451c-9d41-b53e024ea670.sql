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

  IF p_complaint_table = 'complaints' THEN
    SELECT office_id INTO v_office_id FROM public.complaints WHERE id = p_complaint_id;
  ELSE
    SELECT office_id INTO v_office_id FROM public.landlord_complaints WHERE id = p_complaint_id;
  END IF;
  IF v_office_id IS NULL THEN RAISE EXCEPTION 'Assign the complaint to an office before selecting a hearing room'; END IF;

  IF p_room_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.hearing_rooms
    WHERE id = p_room_id AND active AND office_id = v_office_id
  ) THEN RAISE EXCEPTION 'Select an active hearing room from the complaint office'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.admin_staff
    WHERE user_id = p_assigned_to
      AND (office_id = v_office_id OR v_office_id = ANY(COALESCE(office_ids, ARRAY[]::text[])))
  ) THEN RAISE EXCEPTION 'Assignee is not active staff for the complaint office'; END IF;

  SELECT * INTO v_current FROM public.complaint_assignments
  WHERE complaint_id = p_complaint_id AND complaint_table = p_complaint_table AND unassigned_at IS NULL
  ORDER BY assigned_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND AND nullif(trim(p_reason),'') IS NULL THEN RAISE EXCEPTION 'Reason for reassignment is required'; END IF;
  IF FOUND THEN UPDATE public.complaint_assignments SET unassigned_at = now() WHERE id = v_current.id; END IF;

  INSERT INTO public.complaint_assignments(complaint_id,complaint_table,assigned_to,assigned_by,reason,room_id)
  VALUES(p_complaint_id,p_complaint_table,p_assigned_to,v_actor,COALESCE(nullif(trim(p_reason),''),'Initial assignment'),p_room_id)
  RETURNING id INTO v_new_id;

  INSERT INTO public.complaint_audit_log(case_id,case_kind,actor_id,action,old_value,new_value)
  VALUES(p_complaint_id,CASE WHEN p_complaint_table='complaints' THEN 'complaint' ELSE 'landlord_complaint' END,v_actor,
    CASE WHEN v_current.id IS NULL THEN 'case_assigned' ELSE 'case_reassigned' END,
    CASE WHEN v_current.id IS NULL THEN NULL ELSE jsonb_build_object('assigned_to',v_current.assigned_to,'room_id',v_current.room_id) END,
    jsonb_build_object('assigned_to',p_assigned_to,'room_id',p_room_id,'reason',COALESCE(nullif(trim(p_reason),''),'Initial assignment'),'assigned_by',v_actor,'assigned_at',now(),'office_id',v_office_id));
  RETURN v_new_id;
END $$;
REVOKE ALL ON FUNCTION public.assign_complaint_case(uuid,text,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_complaint_case(uuid,text,uuid,uuid,text) TO authenticated, service_role;