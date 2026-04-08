

# Fix: "FOR UPDATE is not allowed with aggregate functions"

## Root Cause

The `unassign_serial_atomic` database function uses `SELECT count(*) INTO v_stock_count FROM rent_card_serial_stock WHERE ... FOR UPDATE`. PostgreSQL prohibits `FOR UPDATE` on queries with aggregate functions (`count()`).

The same issue exists for the card count query further down.

## Fix

Create a migration that replaces `unassign_serial_atomic` with corrected query structure:

1. **Lock rows first** with a plain `SELECT ... FOR UPDATE` (no aggregates)
2. **Count separately** using `GET DIAGNOSTICS` or a second query without `FOR UPDATE`

Specifically:
- Replace `SELECT count(*) INTO v_stock_count FROM rent_card_serial_stock WHERE serial_number = p_serial_number FOR UPDATE` with:
  - `PERFORM 1 FROM rent_card_serial_stock WHERE serial_number = p_serial_number FOR UPDATE;` (locks rows)
  - `SELECT count(*) INTO v_stock_count FROM rent_card_serial_stock WHERE serial_number = p_serial_number;` (counts without lock)
- Apply the same pattern to the card locking section — the existing `FOR v_card IN SELECT ... FOR UPDATE` loop is fine (no aggregate), but the later `SELECT count(*) INTO v_card_count` doesn't need `FOR UPDATE` since rows are already locked by the loop above.

## File

| File | Change |
|------|--------|
| New migration SQL | `CREATE OR REPLACE FUNCTION public.unassign_serial_atomic(...)` with separated lock + count queries |

No frontend changes needed — the function signature and return type stay identical.

