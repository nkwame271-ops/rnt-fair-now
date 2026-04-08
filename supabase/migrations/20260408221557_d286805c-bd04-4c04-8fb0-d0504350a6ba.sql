
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

  -- Lock and check cards (loop with FOR UPDATE is fine, no aggregate)
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

  -- Count cards separately (rows already locked above)
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
