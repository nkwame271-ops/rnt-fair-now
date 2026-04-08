

# Plan: Procurement Report Date Filter + Fix Unassign Serials

## Issue 1: Procurement Report — Add Custom Date Range Filter

Currently the report loads all batches with no date filtering. Add the same date preset system used in the Escrow Dashboard.

**File: `src/pages/regulator/rent-cards/ProcurementReport.tsx`**

- Add `DatePreset` type and `getPresetRange` helper (same as Escrow: All, Today, Yesterday, Last 7 Days, This Week, This Month, Custom)
- Add state for `datePreset`, `customFrom`, `customTo`
- Add a filter bar with preset buttons and custom date pickers (Calendar popovers)
- Filter the `generation_batches` query by `created_at` using `.gte()` and `.lte()` based on the effective date range
- Add a "Search" button to re-fetch with the selected range
- Update PDF export to include the date range in the header

## Issue 2: Unassign Serials — Serial Not Found

The root cause is that `rent_card_serial_stock` stores **two rows** per serial number in paired mode (pair_index 1 and 2). The current search uses `.eq("serial_number", ...).single()`, which fails with a PostgREST error when 2 rows match (Supabase `.single()` throws if more than one row is returned).

**File: `src/pages/regulator/rent-cards/AdminActions.tsx`**

- Change `handleSerialSearch` to use `.eq("serial_number", ...).eq("pair_index", 1)` (or drop `.single()` and take the first result) so the lookup succeeds for paired serials
- Display additional info: `pair_index`, `stock_type`, `assigned_to_card_id`
- When the serial is "assigned", check if it's linked to a tenancy by looking up the `rent_cards` table via `assigned_to_card_id` — if no active tenancy, show the "Unassign" button

**File: `supabase/functions/admin-action/index.ts`**

- In the `unassign_serial` case, change the query from `.eq("serial_number", target_id).single()` to `.eq("serial_number", target_id).order("pair_index").limit(1).single()` so it finds the primary record
- After unassigning pair_index 1, also unassign pair_index 2 (update both rows back to `available` status and clear `assigned_to_card_id`, `assigned_at`, `assigned_by`)
- If pair_index 2 has a separate `assigned_to_card_id`, also reset that rent card's serial back to `awaiting_serial`

## Summary

| File | Change |
|------|--------|
| `ProcurementReport.tsx` | Add date preset filter bar with custom range, filter query by `created_at` |
| `AdminActions.tsx` | Fix `.single()` to filter by `pair_index=1`, show serial details correctly |
| `admin-action/index.ts` | Fix `.single()` query, unassign both pair indices atomically |

