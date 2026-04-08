-- 1. Backfill missing pair_index = 2 rows for serials that only have pair_index = 1
INSERT INTO rent_card_serial_stock (
  serial_number, office_name, status, batch_label, region, pair_index,
  pair_group, stock_type, office_allocation_id
)
SELECT
  s1.serial_number,
  s1.office_name,
  s1.status,
  s1.batch_label,
  s1.region,
  2 as pair_index,
  s1.pair_group,
  s1.stock_type,
  s1.office_allocation_id
FROM rent_card_serial_stock s1
WHERE s1.pair_index = 1
  AND NOT EXISTS (
    SELECT 1 FROM rent_card_serial_stock s2
    WHERE s2.serial_number = s1.serial_number
      AND s2.pair_index = 2
  );

-- 2. For assigned stock rows, if the referenced card no longer matches the serial, clear the link
UPDATE rent_card_serial_stock ss
SET status = 'available',
    assigned_to_card_id = NULL,
    assigned_at = NULL,
    assigned_by = NULL
WHERE ss.status = 'assigned'
  AND ss.assigned_to_card_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM rent_cards rc
    WHERE rc.id = ss.assigned_to_card_id
      AND rc.serial_number = ss.serial_number
  );

-- 3. Ensure pair_index 2 rows mirror the status of their pair_index 1 sibling
-- (for assigned pairs where pair_index 2 was just backfilled as 'available')
UPDATE rent_card_serial_stock s2
SET status = s1.status,
    assigned_to_card_id = (
      SELECT rc.id FROM rent_cards rc
      WHERE rc.serial_number = s2.serial_number
        AND rc.id != s1.assigned_to_card_id
      LIMIT 1
    ),
    assigned_at = s1.assigned_at,
    assigned_by = s1.assigned_by
FROM rent_card_serial_stock s1
WHERE s1.serial_number = s2.serial_number
  AND s1.pair_index = 1
  AND s2.pair_index = 2
  AND s1.status = 'assigned'
  AND s2.status = 'available'
  AND s1.assigned_to_card_id IS NOT NULL;