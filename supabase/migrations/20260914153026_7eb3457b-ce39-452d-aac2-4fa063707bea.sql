CREATE OR REPLACE FUNCTION public.lookup_serial_details(p_serials text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_results jsonb := '[]'::jsonb;
  v_serial text;
  v_stock_rows jsonb;
  v_card_info jsonb;
  v_last_action jsonb;
  v_location_kind text;
  v_location_label text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only Super Admin can use the serial lookup tool';
  END IF;

  IF p_serials IS NULL OR array_length(p_serials, 1) IS NULL THEN
    RETURN jsonb_build_object('results', '[]'::jsonb);
  END IF;

  FOREACH v_serial IN ARRAY p_serials LOOP
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'pair_index', s.pair_index,
      'status', s.status,
      'stock_type', s.stock_type,
      'office_name', s.office_name,
      'region', s.region,
      'batch_label', s.batch_label,
      'assigned_to_card_id', s.assigned_to_card_id,
      'assigned_at', s.assigned_at,
      'unassigned_at', s.unassigned_at,
      'revoked_at', s.revoked_at,
      'revoke_reason', s.revoke_reason,
      'created_at', s.created_at,
      'created_by', s.created_by,
      'source_note', s.source_note,
      'is_reupload', s.is_reupload,
      'stock_source', s.stock_source
    ) ORDER BY (s.status = 'revoked'), s.pair_index, s.created_at DESC), '[]'::jsonb)
    INTO v_stock_rows
    FROM public.rent_card_serial_stock s
    WHERE s.serial_number = v_serial;

    IF v_stock_rows = '[]'::jsonb THEN
      v_results := v_results || jsonb_build_object('serial_number', v_serial, 'found', false);
      CONTINUE;
    END IF;

    SELECT
      s.stock_type,
      CASE
        WHEN s.stock_type = 'central' THEN 'Central Pool'
        WHEN s.stock_type = 'regional' THEN 'Regional Pool: ' || COALESCE(s.region, '—')
        WHEN s.stock_type = 'office'   THEN 'Office: ' || COALESCE(s.office_name, '—')
                                          || COALESCE(' (' || s.region || ')', '')
        ELSE s.stock_type
      END
    INTO v_location_kind, v_location_label
    FROM public.rent_card_serial_stock s
    WHERE s.serial_number = v_serial
    ORDER BY (s.status = 'revoked'), s.pair_index, s.created_at DESC
    LIMIT 1;

    SELECT jsonb_build_object(
      'cards', COALESCE(jsonb_agg(jsonb_build_object(
        'card_id', rc.id,
        'card_status', rc.status,
        'landlord_user_id', rc.landlord_user_id,
        'landlord_name', lp.full_name,
        'tenant_user_id', rc.tenant_user_id,
        'tenant_name', tp.full_name,
        'tenancy_id', rc.tenancy_id,
        'tenancy_code', t.registration_code,
        'tenancy_status', t.status
      )), '[]'::jsonb)
    )
    INTO v_card_info
    FROM public.rent_cards rc
    LEFT JOIN public.profiles lp ON lp.user_id = rc.landlord_user_id
    LEFT JOIN public.profiles tp ON tp.user_id = rc.tenant_user_id
    LEFT JOIN public.tenancies t ON t.id = rc.tenancy_id
    WHERE rc.serial_number = v_serial;

    SELECT jsonb_build_object(
      'action', a.action,
      'reason', a.reason,
      'admin_user_id', a.admin_user_id,
      'created_at', a.created_at
    )
    INTO v_last_action
    FROM public.admin_audit_log a
    WHERE a.target_type IN ('serial', 'serial_stock')
      AND a.target_id = v_serial
    ORDER BY a.created_at DESC
    LIMIT 1;

    v_results := v_results || jsonb_build_object(
      'serial_number', v_serial,
      'found', true,
      'location_kind', v_location_kind,
      'location_label', v_location_label,
      'stock_rows', v_stock_rows,
      'assignment', v_card_info,
      'last_action', v_last_action
    );
  END LOOP;

  RETURN jsonb_build_object('results', v_results);
END;
$function$;