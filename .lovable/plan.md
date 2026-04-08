

# Plan: Fix Serial Preview & Manual Range Allocation

## Two Issues

### 1. SerialGenerator Preview — Show Every Serial, Not Summary
Currently the preview table shows one row per region (Region, Code, Qty, First, Last). The user wants to see **every individual serial number** listed, and whether it has a pair (pair_index 1 and 2).

**File: `src/pages/regulator/rent-cards/SerialGenerator.tsx`**

Replace the preview table (lines 327-358) with a full serial listing:
- For each selected region entry, loop from `start` to `end` and render every serial: `{prefix}{code}-{padded_number}`
- Show two columns: "Serial Number" and "Copies" (showing "2 (Paired)" or "1 (Single)" based on paired mode)
- Keep the scrollable container with max-height, increase to ~400px since more rows
- Add a count header: "Showing X serials (Y physical cards)"

### 2. Office Allocation — Manual Range with Serial Search/Autocomplete
The range transfer fails because the user types short numbers like "001" but the DB stores full serial numbers like `RCD-2026-GAR-0001`. Two sub-fixes:

**a) Add serial search/autocomplete to range inputs (like PendingPurchases)**

**File: `src/pages/regulator/rent-cards/OfficeAllocation.tsx`**

- When `by_range` mode is selected and a region is chosen, fetch all available regional serials for that region (same query as PendingPurchases: `stock_type='regional'`, `status='available'`, `pair_index=1`, ordered by `serial_number`)
- Store in state: `regionalSerials: SerialOption[]`
- Replace the plain text inputs for Start/End with a searchable dropdown (reuse or replicate the `SerialSearchPicker` pattern from PendingPurchases) — as the admin types, show matching serials from the regional pool
- The selected values become the **full serial numbers** (e.g. `RCD-2026-GAR-0001`)

**b) Fix backend range query**

**File: `supabase/functions/admin-action/index.ts`**

The `.gte("serial_number", aStartSerial).lte("serial_number", aEndSerial)` query (line 313-314) already works correctly **if full serial numbers are passed**. Once the frontend sends full serial numbers instead of short suffixes, this will match. No backend changes needed.

**c) Compute range quantity from actual serials**

Update `rangeQuantities` computation: instead of parsing start/end as integers, count actual serials from `regionalSerials` that fall within the selected range (between start and end serial alphabetically). This ensures accurate quantity even if some serials in the range are missing.

## Summary

| File | Change |
|------|--------|
| `SerialGenerator.tsx` | Replace summary preview with full per-serial listing showing pair status |
| `OfficeAllocation.tsx` | Add regional serial fetch, searchable serial picker for range start/end, compute range qty from actual data |

No backend/migration changes needed.

