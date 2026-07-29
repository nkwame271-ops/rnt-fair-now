CREATE OR REPLACE FUNCTION public.issue_car_case_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix text := 'CAR';
  v_next bigint;
BEGIN
  SELECT NULLIF(trim(config_value->>'prefix'), '')
    INTO v_prefix
  FROM public.platform_config
  WHERE config_key = 'complaint_case_numbering'
  LIMIT 1;

  v_prefix := COALESCE(v_prefix, 'CAR');
  v_next := nextval('public.car_case_number_seq');
  RETURN upper(v_prefix) || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_complaint_case_number(p_case_id uuid, p_table text DEFAULT 'complaints')
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_case_number text;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can issue complaint case numbers';
  END IF;

  IF p_table = 'complaints' THEN
    SELECT case_number INTO v_case_number
    FROM public.complaints
    WHERE id = p_case_id
    FOR UPDATE;

    IF v_case_number IS NULL OR trim(v_case_number) = '' THEN
      v_case_number := public.issue_car_case_number();
      UPDATE public.complaints
      SET case_number = v_case_number,
          updated_at = now()
      WHERE id = p_case_id;
    END IF;
  ELSIF p_table = 'landlord_complaints' THEN
    SELECT case_number INTO v_case_number
    FROM public.landlord_complaints
    WHERE id = p_case_id
    FOR UPDATE;

    IF v_case_number IS NULL OR trim(v_case_number) = '' THEN
      v_case_number := public.issue_car_case_number();
      UPDATE public.landlord_complaints
      SET case_number = v_case_number,
          updated_at = now()
      WHERE id = p_case_id;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported complaint table: %', p_table;
  END IF;

  IF v_case_number IS NULL OR trim(v_case_number) = '' THEN
    RAISE EXCEPTION 'Complaint % not found', p_case_id;
  END IF;

  RETURN v_case_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_car_case_number() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_complaint_case_number(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.assign_premium_property_to_agent(p_subscription_id uuid, p_agent_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sub record;
  v_agent record;
  v_previous_agent uuid;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can assign Premium Service agents';
  END IF;

  SELECT * INTO v_sub
  FROM public.premium_subscriptions
  WHERE id = p_subscription_id
  FOR UPDATE;

  IF v_sub IS NULL THEN
    RAISE EXCEPTION 'Premium subscription not found';
  END IF;

  IF p_agent_user_id IS NOT NULL THEN
    SELECT * INTO v_agent
    FROM public.agent_staff
    WHERE user_id = p_agent_user_id
      AND status = 'active';
    IF v_agent IS NULL THEN
      RAISE EXCEPTION 'Selected agent is not active';
    END IF;
  END IF;

  v_previous_agent := v_sub.assigned_agent_user_id;

  UPDATE public.premium_subscriptions
  SET assigned_agent_user_id = p_agent_user_id,
      updated_at = now()
  WHERE id = p_subscription_id;

  UPDATE public.properties
  SET management_enabled = true,
      management_assigned_staff_id = p_agent_user_id,
      management_assigned_office_id = COALESCE(v_agent.operating_area, v_agent.region, management_assigned_office_id),
      management_enabled_at = COALESCE(management_enabled_at, now())
  WHERE id = v_sub.property_id;

  IF v_previous_agent IS NOT NULL AND v_previous_agent IS DISTINCT FROM p_agent_user_id THEN
    UPDATE public.agent_assignments
    SET active = false,
        updated_at = now()
    WHERE agent_user_id = v_previous_agent
      AND owner_user_id = v_sub.subscriber_user_id
      AND active = true;
  END IF;

  IF p_agent_user_id IS NOT NULL THEN
    INSERT INTO public.agent_assignments(agent_user_id, owner_user_id, owner_role, scope_notes, assigned_by, active)
    VALUES (
      p_agent_user_id,
      v_sub.subscriber_user_id,
      v_sub.subscriber_role,
      'Premium Service — property ' || v_sub.property_id::text,
      auth.uid(),
      true
    )
    ON CONFLICT DO NOTHING;

    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES
      (p_agent_user_id, 'Premium property assigned', 'A Premium Service property has been assigned to you.', 'agent_assignment', '/agent/assigned-properties'),
      (v_sub.subscriber_user_id, 'Premium Service agent updated', 'Your assigned Premium Service agent has been updated.', 'premium_agent_assigned', '/landlord/premium');
  ELSE
    INSERT INTO public.notifications(user_id, title, message, type, link)
    VALUES (v_sub.subscriber_user_id, 'Premium Service awaiting agent', 'Your Premium Service property is awaiting a new agent assignment.', 'premium_agent_unassigned', '/landlord/premium');
  END IF;

  INSERT INTO public.property_management_log(property_id, action, actor_id, payload)
  VALUES (
    v_sub.property_id,
    CASE WHEN p_agent_user_id IS NULL THEN 'premium_agent_removed' ELSE 'premium_agent_assigned' END,
    auth.uid(),
    jsonb_build_object('subscription_id', p_subscription_id, 'previous_agent_user_id', v_previous_agent, 'agent_user_id', p_agent_user_id)
  );

  RETURN jsonb_build_object('success', true, 'subscription_id', p_subscription_id, 'agent_user_id', p_agent_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_premium_property_to_agent(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.regulator_set_agent_status(p_agent_user_id uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_status text;
BEGIN
  IF NOT public.is_main_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can manage agent profiles';
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'revoked') THEN
    RAISE EXCEPTION 'Unsupported agent status: %', p_status;
  END IF;

  SELECT status INTO v_old_status
  FROM public.agent_staff
  WHERE user_id = p_agent_user_id
  FOR UPDATE;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Agent profile not found';
  END IF;

  UPDATE public.agent_staff
  SET status = p_status,
      updated_at = now()
  WHERE user_id = p_agent_user_id;

  IF p_status <> 'active' THEN
    UPDATE public.agent_assignments
    SET active = false,
        updated_at = now()
    WHERE agent_user_id = p_agent_user_id
      AND active = true;

    UPDATE public.premium_subscriptions
    SET assigned_agent_user_id = NULL,
        updated_at = now()
    WHERE assigned_agent_user_id = p_agent_user_id
      AND status = 'active';
  END IF;

  INSERT INTO public.admin_audit_log(admin_user_id, action, target_type, target_id, reason, old_state, new_state)
  VALUES (
    auth.uid(),
    'agent_status_changed',
    'agent_staff',
    p_agent_user_id,
    p_reason,
    jsonb_build_object('status', v_old_status),
    jsonb_build_object('status', p_status)
  );

  RETURN jsonb_build_object('success', true, 'old_status', v_old_status, 'new_status', p_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.regulator_set_agent_status(uuid, text, text) TO authenticated, service_role;

INSERT INTO public.platform_config(config_key, config_value, description)
VALUES ('complaint_case_numbering', jsonb_build_object('prefix', 'CAR'), 'Configurable complaint case number prefix')
ON CONFLICT (config_key) DO UPDATE
SET config_value = COALESCE(public.platform_config.config_value, '{}'::jsonb) || EXCLUDED.config_value,
    description = EXCLUDED.description,
    updated_at = now();