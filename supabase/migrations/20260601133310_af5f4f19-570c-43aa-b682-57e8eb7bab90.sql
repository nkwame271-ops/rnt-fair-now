
CREATE OR REPLACE FUNCTION public.move_serials_atomic(
  p_serials text[],
  p_target_kind text,
  p_target_region text,
  p_target_office_id text,
  p_target_office_name text,
  p_actor uuid,
  p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_serial text;
  v_moved text[] := ARRAY[]::text[];
  v_skipped jsonb := '[]'::jsonb;
  v_row record;
  v_source_kind text;
  v_source_label text;
  v_dest_label text;
  v_can_move boolean;
  v_skip_reason text;
  v_pair_count int;
  v_dummy uuid;
  v_caller uuid;
BEGIN
  v_caller := COALESCE(p_actor, auth.uid());
  IF v_caller IS NULL OR NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Only Super Admin can move stock';
  END IF;

  IF p_target_kind NOT IN ('central', 'regional', 'office') THEN
    RAISE EXCEPTION 'Invalid target kind: %', p_target_kind;
  END IF;

  IF p_target_kind = 'regional' AND (p_target_region IS NULL OR p_target_region = '') THEN
    RAISE EXCEPTION 'Region required for regional move';
  END IF;

  IF p_target_kind = 'office' AND (p_target_office_name IS NULL OR p_target_office_name = '') THEN
    RAISE EXCEPTION 'Office name required for office move';
  END IF;

  IF p_serials IS NULL OR array_length(p_serials, 1) IS NULL THEN
    RETURN jsonb_build_object('moved', '[]'::jsonb, 'skipped', '[]'::jsonb, 'total', 0);
  END IF;

  v_dest_label := CASE
    WHEN p_target_kind = 'central' THEN 'Central Pool'
    WHEN p_target_kind = 'regional' THEN 'Regional:' || COALESCE(p_target_region, '—')
    WHEN p_target_kind = 'office' THEN 'Office:' || COALESCE(p_target_office_name, '—')
  END;

  FOREACH v_serial IN ARRAY p_serials LOOP
    v_can_move := true;
    v_skip_reason := NULL;
    v_source_kind := NULL;
    v_source_label := NULL;
    v_pair_count := 0;

    FOR v_dummy IN
      SELECT id FROM public.rent_card_serial_stock
      WHERE serial_number = v_serial
      FOR UPDATE
    LOOP
      v_pair_count := v_pair_count + 1;
    END LOOP;

    IF v_pair_count = 0 THEN
      v_skipped := v_skipped || jsonb_build_object('serial', v_serial, 'reason', 'Not found in stock');
      CONTINUE;
    END IF;

    FOR v_row IN
      SELECT status, stock_type, region, office_name
      FROM public.rent_card_serial_stock
      WHERE serial_number = v_serial
      ORDER BY pair_index
    LOOP
      IF v_source_kind IS NULL THEN
        v_source_kind := v_row.stock_type;
        v_source_label := CASE
          WHEN v_row.stock_type = 'central' THEN 'Central Pool'
          WHEN v_row.stock_type = 'regional' THEN 'Regional:' || COALESCE(v_row.region, '—')
          WHEN v_row.stock_type = 'office' THEN 'Office:' || COALESCE(v_row.office_name, '—')
          ELSE v_row.stock_type
        END;
      END IF;

      IF v_row.status <> 'available' THEN
        v_can_move := false;
        v_skip_reason := 'Serial is ' || v_row.status || ' (only available serials can be moved)';
        EXIT;
      END IF;
    END LOOP;

    IF NOT v_can_move THEN
      v_skipped := v_skipped || jsonb_build_object('serial', v_serial, 'reason', v_skip_reason);
      CONTINUE;
    END IF;

    IF COALESCE(v_source_label, '') = v_dest_label THEN
      v_skipped := v_skipped || jsonb_build_object('serial', v_serial, 'reason', 'Already at destination');
      CONTINUE;
    END IF;

    IF p_target_kind = 'central' THEN
      UPDATE public.rent_card_serial_stock
      SET stock_type = 'central', office_name = '', region = NULL, office_allocation_id = NULL
      WHERE serial_number = v_serial;
    ELSIF p_target_kind = 'regional' THEN
      UPDATE public.rent_card_serial_stock
      SET stock_type = 'regional', office_name = '', region = p_target_region, office_allocation_id = NULL
      WHERE serial_number = v_serial;
    ELSE
      UPDATE public.rent_card_serial_stock
      SET stock_type = 'office',
          office_name = p_target_office_name,
          region = COALESCE(p_target_region, region),
          office_allocation_id = NULL
      WHERE serial_number = v_serial;
    END IF;

    INSERT INTO public.admin_audit_log (
      admin_user_id, action, target_type, target_id, reason, old_state, new_state
    ) VALUES (
      v_caller, 'stock_move', 'serial', v_serial, p_reason,
      jsonb_build_object('source', v_source_label),
      jsonb_build_object(
        'target_kind', p_target_kind,
        'target_region', p_target_region,
        'target_office_id', p_target_office_id,
        'target_office_name', p_target_office_name
      )
    );

    v_moved := array_append(v_moved, v_serial);
  END LOOP;

  RETURN jsonb_build_object(
    'moved', to_jsonb(v_moved),
    'skipped', v_skipped,
    'total', array_length(p_serials, 1)
  );
END;
$func$;

CREATE OR REPLACE FUNCTION public.lookup_serial_details(p_serials text[], p_actor uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_serial text;
  v_stock_rows jsonb;
  v_card_info jsonb;
  v_last_action jsonb;
  v_location_kind text;
  v_location_label text;
  v_caller uuid;
BEGIN
  v_caller := COALESCE(p_actor, auth.uid());
  IF v_caller IS NULL OR NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Only Super Admin can use the serial lookup tool';
  END IF;

  IF p_serials IS NULL OR array_length(p_serials, 1) IS NULL THEN
    RETURN jsonb_build_object('results', '[]'::jsonb);
  END IF;

  FOREACH v_serial IN ARRAY p_serials LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id, 'pair_index', s.pair_index, 'status', s.status,
      'stock_type', s.stock_type, 'office_name', s.office_name, 'region', s.region,
      'batch_label', s.batch_label, 'assigned_to_card_id', s.assigned_to_card_id,
      'assigned_at', s.assigned_at, 'unassigned_at', s.unassigned_at, 'revoked_at', s.revoked_at
    ) ORDER BY s.pair_index), '[]'::jsonb)
    INTO v_stock_rows
    FROM public.rent_card_serial_stock s
    WHERE s.serial_number = v_serial;

    IF v_stock_rows = '[]'::jsonb THEN
      v_results := v_results || jsonb_build_object('serial_number', v_serial, 'found', false);
      CONTINUE;
    END IF;

    SELECT s.stock_type,
      CASE
        WHEN s.stock_type = 'central' THEN 'Central Pool'
        WHEN s.stock_type = 'regional' THEN 'Regional Pool: ' || COALESCE(s.region, '—')
        WHEN s.stock_type = 'office'   THEN 'Office: ' || COALESCE(s.office_name, '—') || COALESCE(' (' || s.region || ')', '')
        ELSE s.stock_type
      END
    INTO v_location_kind, v_location_label
    FROM public.rent_card_serial_stock s
    WHERE s.serial_number = v_serial
    ORDER BY s.pair_index LIMIT 1;

    SELECT jsonb_build_object(
      'cards', COALESCE(jsonb_agg(jsonb_build_object(
        'card_id', rc.id, 'card_status', rc.status,
        'landlord_user_id', rc.landlord_user_id, 'landlord_name', lp.full_name,
        'tenant_user_id', rc.tenant_user_id, 'tenant_name', tp.full_name,
        'tenancy_id', rc.tenancy_id, 'tenancy_code', t.registration_code, 'tenancy_status', t.status
      )), '[]'::jsonb))
    INTO v_card_info
    FROM public.rent_cards rc
    LEFT JOIN public.profiles lp ON lp.user_id = rc.landlord_user_id
    LEFT JOIN public.profiles tp ON tp.user_id = rc.tenant_user_id
    LEFT JOIN public.tenancies t ON t.id = rc.tenancy_id
    WHERE rc.serial_number = v_serial;

    SELECT jsonb_build_object(
      'action', a.action, 'reason', a.reason,
      'admin_user_id', a.admin_user_id, 'created_at', a.created_at)
    INTO v_last_action
    FROM public.admin_audit_log a
    WHERE a.target_type IN ('serial', 'serial_stock') AND a.target_id = v_serial
    ORDER BY a.created_at DESC LIMIT 1;

    v_results := v_results || jsonb_build_object(
      'serial_number', v_serial, 'found', true,
      'location_kind', v_location_kind, 'location_label', v_location_label,
      'stock_rows', v_stock_rows, 'assignment', v_card_info, 'last_action', v_last_action
    );
  END LOOP;

  RETURN jsonb_build_object('results', v_results);
END;
$func$;

GRANT EXECUTE ON FUNCTION public.lookup_serial_details(text[], uuid) TO authenticated, service_role;
