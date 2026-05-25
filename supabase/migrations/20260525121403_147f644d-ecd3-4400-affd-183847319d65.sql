-- 1. Optimistic-lock version columns
ALTER TABLE public.complaints
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

ALTER TABLE public.landlord_complaints
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- 2. Auto-bump version on every UPDATE
CREATE OR REPLACE FUNCTION public.bump_row_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 0) + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bump_version_complaints ON public.complaints;
CREATE TRIGGER bump_version_complaints
  BEFORE UPDATE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

DROP TRIGGER IF EXISTS bump_version_landlord_complaints ON public.landlord_complaints;
CREATE TRIGGER bump_version_landlord_complaints
  BEFORE UPDATE ON public.landlord_complaints
  FOR EACH ROW EXECUTE FUNCTION public.bump_row_version();

-- 3. Safe-update RPC: rejects if caller's expected_version != current row version
CREATE OR REPLACE FUNCTION public.update_complaint_with_version(
  p_table text,
  p_id uuid,
  p_expected_version integer,
  p_patch jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current integer;
  v_set text := '';
  v_key text;
  v_value text;
  v_sql text;
  v_row jsonb;
BEGIN
  IF p_table NOT IN ('complaints','landlord_complaints') THEN
    RAISE EXCEPTION 'p_table must be complaints or landlord_complaints';
  END IF;

  -- Whitelist of mutable columns to keep this RPC safe from arbitrary writes
  -- (status / officer assignment / hearing scheduling / notes — never tenant_user_id, fees, etc.)
  FOR v_key, v_value IN SELECT * FROM jsonb_each_text(p_patch)
  LOOP
    IF v_key NOT IN (
      'status','current_stage','internal_notes',
      'assigned_officer_user_id','hearing_room_id','next_hearing_at',
      'hearing_venue','hearing_officer_name','summons_issued_at',
      'physical_docket_ref','relief_sought'
    ) THEN
      RAISE EXCEPTION 'Field % is not allowed via update_complaint_with_version', v_key;
    END IF;
  END LOOP;

  -- Lock + read current version
  EXECUTE format('SELECT version FROM public.%I WHERE id = $1 FOR UPDATE', p_table)
    INTO v_current
    USING p_id;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Case % not found in %', p_id, p_table;
  END IF;

  IF v_current <> p_expected_version THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'STALE_VERSION',
      'expected', p_expected_version,
      'actual', v_current,
      'message', 'Someone else updated this case while you were editing. Refresh and try again.'
    );
  END IF;

  -- Apply patch using jsonb_populate_record style via dynamic SQL
  v_sql := format(
    'UPDATE public.%I SET (%s) = (SELECT %s FROM jsonb_populate_record(null::public.%I, $1)) WHERE id = $2 RETURNING to_jsonb(public.%I.*)',
    p_table,
    (SELECT string_agg(quote_ident(k), ',') FROM jsonb_object_keys(p_patch) k),
    (SELECT string_agg(quote_ident(k), ',') FROM jsonb_object_keys(p_patch) k),
    p_table,
    p_table
  );

  EXECUTE v_sql INTO v_row USING p_patch, p_id;
  RETURN jsonb_build_object('ok', true, 'row', v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_complaint_with_version(text, uuid, integer, jsonb)
  TO authenticated, service_role;

-- 4. Drop duplicate indexes (each table has two identical office_id b-trees)
DROP INDEX IF EXISTS public.idx_complaints_office_id;
DROP INDEX IF EXISTS public.idx_landlord_complaints_office_id;