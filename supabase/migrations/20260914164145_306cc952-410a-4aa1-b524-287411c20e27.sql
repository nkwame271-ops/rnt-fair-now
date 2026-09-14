CREATE OR REPLACE FUNCTION public.assign_serials_atomic(p_pairs jsonb, p_office_id text, p_office_name text, p_assigned_by uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pair_rec jsonb;
  v_serial text;
  v_card_ids uuid[];
  v_card_id uuid;
  v_stock_row record;
  v_card_row record;
  v_stock_ids uuid[];
  v_stock_id_1 uuid;
  v_stock_id_2 uuid;
  v_total_assigned int := 0;
BEGIN
  IF jsonb_array_length(p_pairs) = 0 THEN
    RAISE EXCEPTION 'No pairs provided';
  END IF;

  FOR pair_rec IN SELECT * FROM jsonb_array_elements(p_pairs)
  LOOP
    v_serial := pair_rec->>'serial_number';
    v_card_ids := ARRAY(SELECT jsonb_array_elements_text(pair_rec->'card_ids'))::uuid[];

    IF array_length(v_card_ids, 1) != 2 THEN
      RAISE EXCEPTION 'Each pair must have exactly 2 card IDs, got % for serial %', array_length(v_card_ids, 1), v_serial;
    END IF;

    IF v_card_ids[1] = v_card_ids[2] THEN
      RAISE EXCEPTION 'Duplicate card IDs in pair for serial %', v_serial;
    END IF;

    -- Lock and validate ONLY the current (non-revoked) stock rows.
    -- Revoked rows are audit history and must never block or be modified.
    v_stock_id_1 := NULL;
    v_stock_id_2 := NULL;
    FOR v_stock_row IN
      SELECT id, status, pair_index
      FROM rent_card_serial_stock
      WHERE serial_number = v_serial
        AND status <> 'revoked'
      ORDER BY pair_index, created_at DESC
      FOR UPDATE
    LOOP
      IF v_stock_row.status <> 'available' THEN
        RAISE EXCEPTION 'Serial % stock row (index %) is not available (status: %)', v_serial, v_stock_row.pair_index, v_stock_row.status;
      END IF;
      IF v_stock_row.pair_index = 1 AND v_stock_id_1 IS NULL THEN
        v_stock_id_1 := v_stock_row.id;
      ELSIF v_stock_row.pair_index = 2 AND v_stock_id_2 IS NULL THEN
        v_stock_id_2 := v_stock_row.id;
      END IF;
    END LOOP;

    IF v_stock_id_1 IS NULL OR v_stock_id_2 IS NULL THEN
      RAISE EXCEPTION 'Serial % has no available stock record for both card sides (re-upload the serial to return it to stock)', v_serial;
    END IF;

    v_stock_ids := ARRAY[v_stock_id_1, v_stock_id_2];

    -- Lock and validate each card
    FOREACH v_card_id IN ARRAY v_card_ids
    LOOP
      SELECT id, status, serial_number INTO v_card_row
      FROM rent_cards
      WHERE id = v_card_id
      FOR UPDATE;

      IF v_card_row IS NULL THEN
        RAISE EXCEPTION 'Card % not found', v_card_id;
      END IF;

      IF v_card_row.status != 'awaiting_serial' THEN
        RAISE EXCEPTION 'Card % is not awaiting_serial (status: %)', v_card_id, v_card_row.status;
      END IF;

      IF v_card_row.serial_number IS NOT NULL THEN
        RAISE EXCEPTION 'Card % already has serial %', v_card_id, v_card_row.serial_number;
      END IF;
    END LOOP;

    -- Assign by explicit stock row id so history rows are untouched
    UPDATE rent_card_serial_stock
    SET status = 'assigned',
        assigned_to_card_id = v_card_ids[1],
        assigned_at = now(),
        assigned_by = p_assigned_by
    WHERE id = v_stock_ids[1];

    UPDATE rent_card_serial_stock
    SET status = 'assigned',
        assigned_to_card_id = v_card_ids[2],
        assigned_at = now(),
        assigned_by = p_assigned_by
    WHERE id = v_stock_ids[2];

    UPDATE rent_cards
    SET serial_number = v_serial,
        status = 'valid',
        assigned_office_id = p_office_id,
        assigned_office_name = p_office_name
    WHERE id = ANY(v_card_ids);

    v_total_assigned := v_total_assigned + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'pairs_assigned', v_total_assigned,
    'cards_assigned', v_total_assigned * 2
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.move_serials_atomic(p_serials text[], p_target_kind text, p_target_region text, p_target_office_id text, p_target_office_name text, p_actor uuid, p_reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Only current (non-revoked) rows participate in a move
    FOR v_dummy IN
      SELECT id FROM public.rent_card_serial_stock
      WHERE serial_number = v_serial
        AND status <> 'revoked'
      FOR UPDATE
    LOOP
      v_pair_count := v_pair_count + 1;
    END LOOP;

    IF v_pair_count = 0 THEN
      v_skipped := v_skipped || jsonb_build_object('serial', v_serial, 'reason', 'No active stock record found');
      CONTINUE;
    END IF;

    FOR v_row IN
      SELECT status, stock_type, region, office_name
      FROM public.rent_card_serial_stock
      WHERE serial_number = v_serial
        AND status <> 'revoked'
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
      WHERE serial_number = v_serial AND status <> 'revoked';
    ELSIF p_target_kind = 'regional' THEN
      UPDATE public.rent_card_serial_stock
      SET stock_type = 'regional', office_name = '', region = p_target_region, office_allocation_id = NULL
      WHERE serial_number = v_serial AND status <> 'revoked';
    ELSE
      UPDATE public.rent_card_serial_stock
      SET stock_type = 'office',
          office_name = p_target_office_name,
          region = COALESCE(p_target_region, region),
          office_allocation_id = NULL
      WHERE serial_number = v_serial AND status <> 'revoked';
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
$function$;