

# Fix Plan: Serial Registry, Quota Reset, Report Alignment, Batch Upload Visibility

## Summary
Four interconnected issues around the rent card procurement pipeline: (1) old uploaded batches invisible in Admin Actions, (2) no way to reset/adjust used quota, (3) reports only read physical stock, not quota, (4) batch uploads missing from Procurement Report.

---

## Issue 1 — Serial Stock Registry in Admin Actions

**Problem**: Admin Actions only lets you search for batches to revoke/void. There's no way to browse all batches (especially old uploads) to find and manage them.

**Fix**: Add a "Serial Stock Registry" section at the top of `AdminActions.tsx` that auto-loads all distinct batch labels with counts on mount (no search required). Each batch shows available/assigned/revoked counts with Revoke and Delete (void) buttons.

**File**: `src/pages/regulator/rent-cards/AdminActions.tsx`

---

## Issue 2 — Quota Reset / Adjust Used Quota

**Problem**: The existing `adjust_office_quota` action in the edge function only adjusts the total quota. There's no way to reset or reduce the "used" count (from `serial_assignments`). If assignments were made in error, the used count is permanent.

**Fix**:
- Add a new admin action `reset_office_quota_usage` in the edge function that deletes or adjusts `serial_assignments` rows for an office, effectively resetting or reducing the used count. Requires password + reason, logged to audit.
- In `OfficeAllocation.tsx`, add a "Reset Used" button next to each quota entry in the Current Quota Status section. This triggers `AdminPasswordConfirm` and calls the new action.

**Files**: `supabase/functions/admin-action/index.ts`, `src/pages/regulator/rent-cards/OfficeAllocation.tsx`

---

## Issue 3 — Report Alignment (Daily Report reads quota + activity)

**Problem**: `DailyReport.tsx` only queries `stock_type = "office"` serials. Offices using quota/numbers-only mode have no physical office stock, so their reports show zeros.

**Fix**: Update `DailyReport.tsx` to also fetch quota info from `office_allocations` and usage from `serial_assignments`, then merge into the report stats. Opening = physical available pairs + quota remaining. Assigned today = physical assigned today + quota assignments today. This matches what the Office Stock cards show.

**File**: `src/pages/regulator/rent-cards/DailyReport.tsx`

---

## Issue 4 — Batch Upload missing from Procurement Report

**Problem**: `ProcurementReport.tsx` only reads from `generation_batches` table. Batch uploads via `SerialBatchUpload` do not create a `generation_batches` record, so they never appear.

**Fix**: Update `SerialBatchUpload.tsx` to insert a `generation_batches` record after successful upload, with `paired_mode: false`, the serial count, and the batch label. This makes uploads appear alongside generated batches in the Procurement Report.

**File**: `src/pages/regulator/rent-cards/SerialBatchUpload.tsx`

---

## Also: Fix existing NULL pair_index data

There are ~10,891 serials in the database with `pair_index = NULL` from previous batch uploads. These are invisible to allocation queries. A data fix will set `pair_index = 1` on all NULL rows.

**Method**: Supabase insert tool (data update, not schema change).

---

## Files to Change

| File | Change |
|------|--------|
| `src/pages/regulator/rent-cards/AdminActions.tsx` | Add Serial Stock Registry section showing all batches |
| `src/pages/regulator/rent-cards/OfficeAllocation.tsx` | Add "Reset Used" button with password confirm for quota reset |
| `src/pages/regulator/rent-cards/DailyReport.tsx` | Merge quota data into report stats |
| `src/pages/regulator/rent-cards/SerialBatchUpload.tsx` | Insert `generation_batches` record on upload |
| `supabase/functions/admin-action/index.ts` | Add `reset_office_quota_usage` action |
| Database data fix | Set `pair_index = 1` on existing NULL rows |

