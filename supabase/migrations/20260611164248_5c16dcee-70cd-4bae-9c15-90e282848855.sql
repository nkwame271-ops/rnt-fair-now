
ALTER TABLE public.developer_organizations
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_changed_by uuid,
  ADD COLUMN IF NOT EXISTS status_reason text;

ALTER TABLE public.developer_organizations
  DROP CONSTRAINT IF EXISTS developer_organizations_account_status_chk;
ALTER TABLE public.developer_organizations
  ADD CONSTRAINT developer_organizations_account_status_chk
  CHECK (account_status IN ('active','suspended','revoked'));

CREATE OR REPLACE FUNCTION public.regulator_set_developer_org_status(
  p_org_id uuid,
  p_status text,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_org record;
  v_revoked int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.is_main_admin(v_caller) OR public.has_role(v_caller, 'regulator'::app_role)) THEN
    RAISE EXCEPTION 'Only regulators can change developer account status';
  END IF;
  IF p_status NOT IN ('active','suspended','revoked') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  SELECT * INTO v_org FROM public.developer_organizations WHERE id = p_org_id FOR UPDATE;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Organization % not found', p_org_id; END IF;

  UPDATE public.developer_organizations
  SET account_status = p_status,
      status_changed_at = now(),
      status_changed_by = v_caller,
      status_reason = p_reason
  WHERE id = p_org_id;

  -- Auto-revoke active keys on suspend/revoke
  IF p_status IN ('suspended','revoked') THEN
    UPDATE public.api_keys
    SET is_active = false,
        revoked_at = COALESCE(revoked_at, now())
    WHERE organization_id = p_org_id
      AND is_active = true;
    GET DIAGNOSTICS v_revoked = ROW_COUNT;
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_user_id, action, target_type, target_id, details
  ) VALUES (
    v_caller,
    'developer_org_status_change',
    'developer_organization',
    p_org_id::text,
    jsonb_build_object(
      'previous_status', v_org.account_status,
      'new_status', p_status,
      'reason', p_reason,
      'keys_revoked', v_revoked
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'org_id', p_org_id,
    'status', p_status,
    'keys_revoked', v_revoked
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.regulator_set_developer_org_status(uuid, text, text) TO authenticated;
