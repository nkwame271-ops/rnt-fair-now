
-- Repair migration: revert escrow_splits incorrectly marked as released
-- when no successful payout transfer exists.

DO $$
DECLARE
  v_repaired_failed int := 0;
  v_repaired_pending int := 0;
BEGIN
  -- Splits with a failed transfer → mark payout_readiness = failed, unrelease
  WITH bad AS (
    SELECT es.id
    FROM public.escrow_splits es
    WHERE es.status = 'active'
      AND es.disbursement_status = 'released'
      AND NOT EXISTS (
        SELECT 1 FROM public.payout_transfers pt
        WHERE pt.escrow_split_id = es.id
          AND pt.status IN ('success','successful','completed')
      )
      AND EXISTS (
        SELECT 1 FROM public.payout_transfers pt
        WHERE pt.escrow_split_id = es.id
          AND pt.status IN ('failed','reversed')
      )
  ), upd AS (
    UPDATE public.escrow_splits es
    SET disbursement_status = 'pending',
        released_at = NULL,
        payout_readiness = 'failed'
    FROM bad
    WHERE es.id = bad.id
    RETURNING es.id
  )
  SELECT count(*) INTO v_repaired_failed FROM upd;

  -- Splits with no successful + no failed transfer (still in-flight or never sent)
  WITH bad AS (
    SELECT es.id
    FROM public.escrow_splits es
    WHERE es.status = 'active'
      AND es.disbursement_status = 'released'
      AND NOT EXISTS (
        SELECT 1 FROM public.payout_transfers pt
        WHERE pt.escrow_split_id = es.id
          AND pt.status IN ('success','successful','completed','failed','reversed')
      )
  ), upd AS (
    UPDATE public.escrow_splits es
    SET disbursement_status = 'pending_transfer',
        released_at = NULL,
        payout_readiness = COALESCE(payout_readiness, 'pending')
    FROM bad
    WHERE es.id = bad.id
    RETURNING es.id
  )
  SELECT count(*) INTO v_repaired_pending FROM upd;

  RAISE NOTICE 'Repaired splits: failed=%, pending_transfer=%', v_repaired_failed, v_repaired_pending;
END $$;
