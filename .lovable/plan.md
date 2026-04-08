

# Plan: Add "Assign by Manual Range" to Office Allocation Transfer

## What changes

Add a third transfer sub-mode ("by_range") alongside the existing "Next Available Serials" and "Transfer by Number Only" options. This lets an admin enter a start and end serial per office, and the system transfers all matching regional serials within that range sequentially.

## Files to change

### 1. `src/pages/regulator/rent-cards/OfficeAllocation.tsx`

- Add `"by_range"` to the `TransferSubMode` type
- Add a new RadioGroup option: "Assign by Manual Range"
- Add state for range inputs: `officeRanges: Record<string, { start: string; end: string }>`
- When `by_range` is selected, replace the per-office quantity input with two text inputs (Start Serial, End Serial) per office
- Compute `totalTransferQty` from ranges: for each office with a valid range, count = numeric(end) - numeric(start) + 1
- Update `canAllocate` to validate range inputs (start <= end, both non-empty)
- In `handleConfirm`, for `by_range` mode, call `admin-action` with `allocation_mode: "range_transfer"` and pass `start_serial` / `end_serial` in the `extra` payload
- Update the `AdminPasswordConfirm` description to reflect range transfer

### 2. `supabase/functions/admin-action/index.ts`

Inside the `"allocate_to_office"` case, add handling for `allocation_mode === "range_transfer"`:

- Extract `start_serial` and `end_serial` from `extra`
- Query `rent_card_serial_stock` for serials in the given region where `stock_type = 'regional'`, `status = 'available'`, and `serial_number` between start and end (inclusive), ordered ascending
- Validate: if returned count is 0 or less than expected range, throw an error with details on which serials are missing/unavailable
- Group by serial_number to capture both pair indices
- Create the `office_allocations` record with `allocation_mode: "range_transfer"`, `start_serial`, `end_serial`, actual `serial_numbers` array, and `quantity` = unique serial count
- Update all matched rows to `stock_type: "office"` and `office_name` (same batch logic as existing transfer mode)
- Set `oldState`/`newState` for audit logging

## Validation rules (server-side in edge function)

- All serials in the range must exist in regional stock for the selected region
- All serials must have `status = 'available'`
- The quantity (range size) must not exceed available regional stock
- Standard password re-auth and audit logging apply (already handled by the existing flow)

## No other files need changes

The allocation history, reports, reconciliation, and stock displays already work off the `office_allocations` and `rent_card_serial_stock` tables — a range transfer updates the same fields as a regular transfer, so downstream views reflect it automatically.

