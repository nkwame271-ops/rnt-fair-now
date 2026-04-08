
-- Fix assign_serials_atomic: map assigned_to_card_id per pair_index
CREATE OR REPLACE FUNCTION public.assign_serials_atomic(
  p_pairs jsonb,
  p_office_id text,
  p_office_name text,
  p_assigned_by uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pair_rec jsonb;
  v_serial text;
  v_card_ids uuid[];
  v_card_id uuid;
  v_stock_row record;
  v_card_row record;
  v_stock_count int;
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

    -- Lock and validate stock rows (both pair_index 1 and 2)
    v_stock_count := 0;
    FOR v_stock_row IN
      SELECT id, status, pair_index
      FROM rent_card_serial_stock
      WHERE serial_number = v_serial
      ORDER BY pair_index
      FOR UPDATE
    LOOP
      IF v_stock_row.status != 'available' THEN
        RAISE EXCEPTION 'Serial % stock row (index %) is not available (status: %)', v_serial, v_stock_row.pair_index, v_stock_row.status;
      END IF;
      v_stock_count := v_stock_count + 1;
    END LOOP;

    IF v_stock_count != 2 THEN
      RAISE EXCEPTION 'Serial % must have exactly 2 stock rows, found %', v_serial, v_stock_count;
    END IF;

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

    -- All validations passed — perform assignment per pair_index
    UPDATE rent_card_serial_stock
    SET status = 'assigned',
        assigned_to_card_id = v_card_ids[1],
        assigned_at = now(),
        assigned_by = p_assigned_by
    WHERE serial_number = v_serial AND pair_index = 1;

    UPDATE rent_card_serial_stock
    SET status = 'assigned',
        assigned_to_card_id = v_card_ids[2],
        assigned_at = now(),
        assigned_by = p_assigned_by
    WHERE serial_number = v_serial AND pair_index = 2;

    -- Update both rent cards
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
$$;

-- Fix unassign_serial_atomic: separate lock from count
CREATE OR REPLACE FUNCTION public.unassign_serial_atomic(p_serial_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_card record;
  v_tenancy record;
  v_stock_count int;
  v_card_count int;
BEGIN
  -- Lock stock rows first (no aggregate)
  PERFORM 1
  FROM rent_card_serial_stock
  WHERE serial_number = p_serial_number
  FOR UPDATE;

  -- Count separately (no FOR UPDATE)
  SELECT count(*) INTO v_stock_count
  FROM rent_card_serial_stock
  WHERE serial_number = p_serial_number;

  IF v_stock_count = 0 THEN
    RAISE EXCEPTION 'Serial % not found in stock', p_serial_number;
  END IF;

  -- Lock and check cards
  FOR v_card IN
    SELECT id, status, tenancy_id
    FROM rent_cards
    WHERE serial_number = p_serial_number
    FOR UPDATE
  LOOP
    IF v_card.tenancy_id IS NOT NULL THEN
      SELECT status INTO v_tenancy
      FROM tenancies
      WHERE id = v_card.tenancy_id;

      IF v_tenancy IS NOT NULL AND v_tenancy.status NOT IN ('terminated', 'expired') THEN
        RAISE EXCEPTION 'Cannot unassign: serial is linked to an active tenancy';
      END IF;
    END IF;
  END LOOP;

  -- Count cards separately
  SELECT count(*) INTO v_card_count
  FROM rent_cards
  WHERE serial_number = p_serial_number;

  -- Full factory reset of all cards
  UPDATE rent_cards
  SET serial_number = NULL,
      status = 'awaiting_serial',
      tenant_user_id = NULL,
      property_id = NULL,
      unit_id = NULL,
      tenancy_id = NULL,
      start_date = NULL,
      expiry_date = NULL,
      current_rent = NULL,
      previous_rent = NULL,
      advance_paid = NULL,
      last_payment_status = NULL,
      activated_at = NULL,
      qr_token = NULL,
      card_role = NULL,
      assigned_office_id = NULL,
      assigned_office_name = NULL
  WHERE serial_number = p_serial_number;

  -- Reset all stock rows
  UPDATE rent_card_serial_stock
  SET status = 'available',
      assigned_to_card_id = NULL,
      assigned_at = NULL,
      assigned_by = NULL
  WHERE serial_number = p_serial_number;

  RETURN jsonb_build_object(
    'success', true,
    'cards_reset', v_card_count,
    'stock_rows_reset', v_stock_count
  );
END;
$function$;
