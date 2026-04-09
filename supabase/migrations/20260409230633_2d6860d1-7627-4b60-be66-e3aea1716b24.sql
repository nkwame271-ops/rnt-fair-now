
-- 1. Schema additions
ALTER TABLE rent_card_serial_stock ADD COLUMN IF NOT EXISTS unassigned_at timestamptz;
ALTER TABLE rent_card_serial_stock ADD COLUMN IF NOT EXISTS stock_source text NOT NULL DEFAULT 'generation';

ALTER TABLE inventory_adjustments ADD COLUMN IF NOT EXISTS reference_id text;
ALTER TABLE inventory_adjustments ADD COLUMN IF NOT EXISTS correction_tag text;
ALTER TABLE inventory_adjustments ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_adjustments_idempotency ON inventory_adjustments (idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 2. Reconciliation period snapshots table
CREATE TABLE IF NOT EXISTS reconciliation_period_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_from timestamptz NOT NULL,
  period_to timestamptz NOT NULL,
  preset text,
  office_id text NOT NULL,
  office_name text NOT NULL,
  metrics jsonb NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reconciliation_period_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Main admins can view snapshots"
  ON reconciliation_period_snapshots FOR SELECT
  TO authenticated
  USING (public.is_main_admin(auth.uid()));

CREATE POLICY "Main admins can create snapshots"
  ON reconciliation_period_snapshots FOR INSERT
  TO authenticated
  WITH CHECK (public.is_main_admin(auth.uid()));

-- 3. Update unassign_serial_atomic to set unassigned_at
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
  PERFORM 1
  FROM rent_card_serial_stock
  WHERE serial_number = p_serial_number
  FOR UPDATE;

  SELECT count(*) INTO v_stock_count
  FROM rent_card_serial_stock
  WHERE serial_number = p_serial_number;

  IF v_stock_count = 0 THEN
    RAISE EXCEPTION 'Serial % not found in stock', p_serial_number;
  END IF;

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

  SELECT count(*) INTO v_card_count
  FROM rent_cards
  WHERE serial_number = p_serial_number;

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

  -- Reset stock rows AND set unassigned_at timestamp
  UPDATE rent_card_serial_stock
  SET status = 'available',
      assigned_to_card_id = NULL,
      assigned_at = NULL,
      assigned_by = NULL,
      unassigned_at = now()
  WHERE serial_number = p_serial_number;

  RETURN jsonb_build_object(
    'success', true,
    'cards_reset', v_card_count,
    'stock_rows_reset', v_stock_count
  );
END;
$function$;

-- 4. Atomic inventory adjustment RPC
CREATE OR REPLACE FUNCTION public.inventory_adjustment_atomic(
  p_adjustment_type text,
  p_office_id text,
  p_office_name text,
  p_region text,
  p_quantity int,
  p_reason text,
  p_performed_by uuid,
  p_note text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_reference_id text DEFAULT NULL,
  p_correction_tag text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_id uuid;
  v_available_count int;
  v_affected int := 0;
  v_row record;
  v_adj_id uuid;
BEGIN
  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM inventory_adjustments
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent', true,
        'existing_id', v_existing_id,
        'message', 'Adjustment already processed'
      );
    END IF;
  END IF;

  IF p_adjustment_type = 'increase' THEN
    -- Create new stock rows for increase
    FOR i IN 1..p_quantity LOOP
      INSERT INTO rent_card_serial_stock (
        serial_number, office_name, status, pair_index, stock_source, region
      ) VALUES (
        'ADJ-' || p_office_id || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(i::text, 4, '0') || '-' || substr(gen_random_uuid()::text, 1, 4),
        p_office_name, 'available', 1, 'adjustment', p_region
      );
      INSERT INTO rent_card_serial_stock (
        serial_number, office_name, status, pair_index, stock_source, region
      ) VALUES (
        'ADJ-' || p_office_id || '-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(i::text, 4, '0') || '-' || substr(gen_random_uuid()::text, 1, 4),
        p_office_name, 'available', 2, 'adjustment', p_region
      );
      v_affected := v_affected + 1;
    END LOOP;

  ELSIF p_adjustment_type = 'decrease' THEN
    -- Lock and count available rows (pair_index=1 only, FIFO, adjustment stock first)
    SELECT count(*) INTO v_available_count
    FROM rent_card_serial_stock
    WHERE office_name = p_office_name
      AND status = 'available'
      AND pair_index = 1;

    IF v_available_count < p_quantity THEN
      RAISE EXCEPTION 'Insufficient stock: % available, % requested', v_available_count, p_quantity;
    END IF;

    -- Select and lock rows deterministically (FIFO, adjustment stock first)
    FOR v_row IN
      SELECT serial_number
      FROM rent_card_serial_stock
      WHERE office_name = p_office_name
        AND status = 'available'
        AND pair_index = 1
      ORDER BY
        CASE WHEN stock_source = 'adjustment' THEN 0 ELSE 1 END,
        created_at ASC,
        serial_number ASC
      LIMIT p_quantity
      FOR UPDATE
    LOOP
      -- Revoke both pair rows for this serial
      UPDATE rent_card_serial_stock
      SET status = 'revoked', revoked_at = now()
      WHERE serial_number = v_row.serial_number
        AND status = 'available';

      v_affected := v_affected + 1;
    END LOOP;

  ELSE
    RAISE EXCEPTION 'Invalid adjustment_type: %', p_adjustment_type;
  END IF;

  -- Record the adjustment
  INSERT INTO inventory_adjustments (
    adjustment_type, office_id, office_name, region, quantity, reason,
    performed_by, note, idempotency_key, reference_id, correction_tag
  ) VALUES (
    p_adjustment_type, p_office_id, p_office_name, p_region, v_affected, p_reason,
    p_performed_by, p_note, p_idempotency_key, p_reference_id, p_correction_tag
  ) RETURNING id INTO v_adj_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'adjustment_id', v_adj_id,
    'pairs_affected', v_affected
  );
END;
$function$;
