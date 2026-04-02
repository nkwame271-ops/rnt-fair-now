

# Fix: Duplicate Key Violation in Paired Serial Generation

## Root Cause

The `rent_card_serial_stock` table has a unique constraint on `serial_number`. In paired mode, the code tries to insert two rows with the same serial number (pair_index 1 = Landlord Copy, pair_index 2 = Tenant Copy). The second insert violates the unique constraint.

## Solution

Replace the unique constraint on `serial_number` alone with a composite unique constraint on `(serial_number, pair_index)`. This allows two rows with the same serial but different pair indices.

### Database Migration

```sql
-- Drop the existing unique constraint on serial_number
ALTER TABLE rent_card_serial_stock DROP CONSTRAINT rent_card_serial_stock_serial_number_key;

-- Add composite unique constraint
ALTER TABLE rent_card_serial_stock ADD CONSTRAINT rent_card_serial_stock_serial_pair_unique UNIQUE (serial_number, pair_index);
```

### Edge Function Update

**File**: `supabase/functions/admin-action/index.ts`

Update the duplicate check (lines 82-90) to also account for pair_index when checking existing serials, so it correctly identifies duplicates per pair:

- For non-paired mode: check serials where `pair_index IS NULL`
- For paired mode: check serials where pair_index is 1 (if a serial exists with pair_index 1, both copies exist)

The existing filter logic at line 92 already works — the duplicate check query just needs a minor refinement to avoid false negatives. Since the current check looks for any row with that serial_number, it will still correctly filter out already-existing serials regardless of pair_index, so no code change is strictly needed beyond the migration.

### Summary

- One database migration: swap unique constraint from `(serial_number)` to `(serial_number, pair_index)`
- No frontend changes needed
- Redeploy edge function only if the duplicate-check logic is refined (optional)

