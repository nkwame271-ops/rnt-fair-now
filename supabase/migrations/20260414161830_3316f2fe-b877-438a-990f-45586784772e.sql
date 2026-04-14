-- Add missing office
INSERT INTO offices (id, name, region) VALUES ('spintex', 'Spintex', 'Greater Accra') ON CONFLICT (id) DO NOTHING;

-- Fix escrow_transactions office_id from finalized splits
UPDATE escrow_transactions et
SET office_id = sub.split_office_id
FROM (
  SELECT DISTINCT ON (es.escrow_transaction_id) 
    es.escrow_transaction_id,
    es.office_id AS split_office_id
  FROM escrow_splits es
  JOIN escrow_transactions et2 ON et2.id = es.escrow_transaction_id
  WHERE es.recipient = 'admin'
    AND es.office_id IS NOT NULL
    AND es.office_id != et2.office_id
  ORDER BY es.escrow_transaction_id
) sub
WHERE et.id = sub.escrow_transaction_id;

-- Fix payment_receipts office_id to match corrected escrow_transactions
UPDATE payment_receipts pr
SET office_id = et.office_id
FROM escrow_transactions et
WHERE pr.escrow_transaction_id = et.id
  AND pr.office_id IS DISTINCT FROM et.office_id
  AND et.office_id IS NOT NULL;