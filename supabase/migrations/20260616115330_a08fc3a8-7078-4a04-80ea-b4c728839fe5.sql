-- 1. Cleanup the test row used to confirm escrow_splits insert works
DELETE FROM public.escrow_splits WHERE id='80139771-0a55-492b-93b7-10ef7519aca5';

-- 2. Default is_service_fee at the column level so legacy expandSecondarySplit
--    rows (which never set this field) no longer trigger silent NOT NULL failures.
ALTER TABLE public.escrow_splits
  ALTER COLUMN is_service_fee SET DEFAULT false;

-- 3. Backfill escrow_splits for registration escrows that completed since
--    2026-06-08 but have NO splits (root cause: silent NOT NULL on is_service_fee).
--    Idempotent: only fires when no splits exist for the escrow.
DO $$
DECLARE
  et RECORD;
  plan_item jsonb;
  v_recipient text;
  v_amount numeric;
  v_description text;
  v_office_id text;
  v_office_pct numeric;
  v_hq_pct numeric;
  v_office_amount numeric;
  v_hq_amount numeric;
  v_is_central boolean;
BEGIN
  FOR et IN
    SELECT e.id, e.office_id, e.metadata, e.payment_type
    FROM public.escrow_transactions e
    WHERE e.payment_type IN ('tenant_registration','landlord_registration','student_registration')
      AND e.status = 'completed'
      AND e.created_at >= '2026-06-08'
      AND NOT EXISTS (SELECT 1 FROM public.escrow_splits es WHERE es.escrow_transaction_id = e.id)
      AND jsonb_typeof(e.metadata -> 'split_plan') = 'array'
  LOOP
    FOR plan_item IN SELECT * FROM jsonb_array_elements(et.metadata -> 'split_plan')
    LOOP
      v_recipient   := plan_item->>'recipient';
      v_amount      := COALESCE((plan_item->>'amount')::numeric, 0);
      v_description := COALESCE(plan_item->>'description', '');
      v_is_central  := v_recipient IN ('platform','nugs','cm','igf');
      v_office_id   := CASE WHEN v_is_central THEN NULL ELSE et.office_id END;

      IF v_recipient IN ('admin','rent_control') THEN
        -- Expand via secondary splits (office + hq)
        SELECT COALESCE(SUM(CASE WHEN sub_recipient='office'       THEN percentage END), 0),
               COALESCE(SUM(CASE WHEN sub_recipient='headquarters' THEN percentage END), 0)
          INTO v_office_pct, v_hq_pct
        FROM public.secondary_split_configurations
        WHERE parent_recipient = v_recipient;

        IF (v_office_pct + v_hq_pct) = 0 THEN
          -- Legacy: single row at parent recipient
          INSERT INTO public.escrow_splits(
            escrow_transaction_id, recipient, amount, description,
            disbursement_status, office_id, release_mode, status, payout_readiness, is_service_fee
          ) VALUES (
            et.id, v_recipient, ROUND(v_amount,2), v_description,
            'pending_transfer', v_office_id, 'manual', 'active', 'pending', false
          );
        ELSE
          v_office_amount := ROUND(v_amount * v_office_pct / 100, 2);
          v_hq_amount     := ROUND(v_amount * v_hq_pct     / 100, 2);
          IF v_office_pct > 0 THEN
            INSERT INTO public.escrow_splits(
              escrow_transaction_id, recipient, amount, description,
              disbursement_status, office_id, release_mode, status, payout_readiness, is_service_fee
            ) VALUES (
              et.id, v_recipient, v_office_amount, v_description || ' (office share)',
              'pending_transfer', et.office_id, 'manual', 'active', 'pending', false
            );
          END IF;
          IF v_hq_pct > 0 THEN
            INSERT INTO public.escrow_splits(
              escrow_transaction_id, recipient, amount, description,
              disbursement_status, office_id, release_mode, status, payout_readiness, is_service_fee
            ) VALUES (
              et.id, v_recipient || '_hq', v_hq_amount, v_description || ' (HQ share)',
              'pending_transfer', NULL, 'auto', 'active', 'pending', false
            );
          END IF;
        END IF;
      ELSE
        -- Simple recipient (platform / landlord / etc.)
        INSERT INTO public.escrow_splits(
          escrow_transaction_id, recipient, amount, description,
          disbursement_status, office_id, release_mode, status, payout_readiness, is_service_fee
        ) VALUES (
          et.id, v_recipient, ROUND(v_amount,2), v_description,
          CASE WHEN v_recipient = 'landlord' THEN 'held' ELSE 'pending_transfer' END,
          v_office_id,
          'manual',
          'active',
          CASE WHEN v_recipient = 'admin' AND v_office_id IS NULL THEN 'unassigned' ELSE 'pending' END,
          false
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;