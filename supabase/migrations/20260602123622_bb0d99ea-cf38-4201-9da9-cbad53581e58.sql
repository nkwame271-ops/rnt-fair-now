CREATE OR REPLACE FUNCTION public.approve_rent_increase_request(p_request_id uuid, p_reviewer uuid, p_reviewer_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_old_rent numeric;
BEGIN
  IF NOT public.is_main_admin(p_reviewer) THEN
    RAISE EXCEPTION 'Only main or super admins can approve rent increases';
  END IF;

  SELECT * INTO r FROM public.rent_increase_requests WHERE id = p_request_id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request % not found', p_request_id; END IF;
  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'Request is not pending (current status: %)', r.status;
  END IF;

  v_old_rent := COALESCE(r.current_approved_rent, 0);

  UPDATE public.rent_increase_requests
  SET status = 'approved',
      reviewer_user_id = p_reviewer,
      reviewer_notes = COALESCE(p_reviewer_notes, reviewer_notes),
      reviewed_at = now()
  WHERE id = p_request_id;

  IF r.unit_id IS NOT NULL THEN
    UPDATE public.units
    SET monthly_rent = r.proposed_rent,
        rent_locked_at = now(),
        rent_locked_amount = r.proposed_rent
    WHERE id = r.unit_id;

    UPDATE public.tenancies
    SET agreed_rent = r.proposed_rent
    WHERE unit_id = r.unit_id
      AND status IN ('active', 'pending', 'renewal_window', 'existing_declared');
  END IF;

  IF r.property_id IS NOT NULL THEN
    UPDATE public.properties
    SET approved_rent = r.proposed_rent,
        rent_locked_at = now(),
        rent_locked_amount = r.proposed_rent
    WHERE id = r.property_id;

    INSERT INTO public.property_events (
      property_id, event_type, old_value, new_value, performed_by, reason
    ) VALUES (
      r.property_id,
      'rent_update',
      jsonb_build_object('rent', v_old_rent, 'effective_until', now()),
      jsonb_build_object('rent', r.proposed_rent, 'effective_from', now(), 'request_id', r.id),
      p_reviewer,
      'Rent increase approved' || CASE WHEN p_reviewer_notes IS NOT NULL AND length(p_reviewer_notes) > 0 THEN ': ' || p_reviewer_notes ELSE '' END
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'request_id', r.id, 'new_rent', r.proposed_rent);
END;
$function$;