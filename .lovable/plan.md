

# Fix: Duplicate Serial Number Errors in Rent Card Management

## Problem
Two places hit the `rent_card_serial_stock_serial_number_key` unique constraint:

1. **Serial Batch Upload** — Inserting serials that already exist in the stock table (e.g. re-uploading same batch).
2. **Pending & Assign** — The assign flow updates the `rent_cards` table with `serial_number`, but the error message references `rent_card_serial_stock`, meaning it's likely trying to insert into `serial_assignments` or a race condition where the same serial gets picked twice.

## Fix

### 1. SerialBatchUpload.tsx — Skip existing serials before insert
- Before inserting, query `rent_card_serial_stock` for all serials in the batch
- Filter out any that already exist
- Show the admin how many were skipped ("X already exist, Y new serials uploaded")
- If all already exist, show a warning instead of failing

### 2. PendingPurchases.tsx — Add conflict handling to assign flow
- Add `.eq("status", "available")` check already exists, but add a re-check after the update to catch race conditions
- Use `upsert` or `ON CONFLICT DO NOTHING` where applicable
- For the `serial_assignments` audit insert (line 152), add conflict handling since the same purchase could be assigned twice if the admin double-clicks
- Wrap the assignment loop to gracefully handle a serial that got claimed between the SELECT and UPDATE

### Files Changed
| File | Change |
|---|---|
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Pre-filter existing serials before insert, show skip count |
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Add conflict guards and prevent double-assign |

