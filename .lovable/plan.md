

# Plan: Fix Three Issues — Unassign/Assign Serial Bugs + Print Receipt

## Issue 1: Duplicate key after unassign + "still active" on re-unassign

**Root cause**: The `unassign_serial_atomic` function resets stock rows to `status = 'available'` but does NOT restore them to their original `stock_type`/`office_name` context. Additionally, the `assign_serials_atomic` function sets `assigned_to_card_id` to only `v_card_ids[1]` for ALL stock rows — so pair_index=2 stock row also points to card 1 instead of card 2. When unassigning and re-assigning, the stock rows are marked available but may have stale metadata, and the pair_index=2 row's `assigned_to_card_id` was never properly differentiated.

The "still active" issue likely occurs because after unassign, the `rent_cards` rows are reset but the UI isn't re-querying, or because the stock rows' status briefly shows `assigned` due to caching/stale reads.

**Fix**: In `unassign_serial_atomic`, the reset logic is correct. The real problem is that `assign_serials_atomic` should update each stock row's `assigned_to_card_id` to the correct card per pair_index (card 1 → pair_index 1, card 2 → pair_index 2), not set all to card 1. This will also prevent orphaned references.

## Issue 2: "Serial claimed by another admin" — assigns half, leaves half

**Root cause**: In `assign_serials_atomic`, when updating stock rows, it does:
```sql
UPDATE rent_card_serial_stock
SET status = 'assigned', assigned_to_card_id = v_card_ids[1]
WHERE serial_number = v_serial;
```
This updates ALL stock rows for that serial to reference card 1. But the validation loop `FOR v_stock_row IN SELECT ... FOR UPDATE` checks each stock row's status. If pair_index=2 rows are somehow in a bad state (e.g., already assigned from a previous partial operation), the entire batch fails partway.

More critically, the stock query in `PendingPurchases.tsx` only fetches `pair_index = 1` rows to display available serials. But the RPC validates BOTH pair_index rows. If pair_index=2 rows are in a different state (e.g., not reset properly from a previous unassign), the RPC will reject the serial even though pair_index=1 shows "available."

**Fix**: 
1. Update `assign_serials_atomic` to assign `v_card_ids[1]` to pair_index=1 stock row and `v_card_ids[2]` to pair_index=2 stock row separately.
2. Ensure the stock validation counts both pair_index rows and requires exactly 2 available rows.

## Issue 3: Print button prints entire page

**Root cause**: `PaymentReceipt` uses `window.print()` which prints the entire page. There are no `@media print` CSS rules to hide non-receipt content.

**Fix**: Add print-specific CSS that hides everything except the targeted receipt when printing. Use a technique where clicking "Print" sets a data attribute on the specific receipt, and `@media print` rules hide all other content.

## Implementation

### Migration: Fix `assign_serials_atomic` and `unassign_serial_atomic`

Replace `assign_serials_atomic` to update stock rows per pair_index:
- pair_index=1 → `assigned_to_card_id = v_card_ids[1]`
- pair_index=2 → `assigned_to_card_id = v_card_ids[2]`

Validate exactly 2 available stock rows exist per serial.

### `PaymentReceipt.tsx` — Scoped printing

Replace `window.print()` with logic that:
1. Adds a `data-printing` attribute to the receipt element
2. Adds a temporary `<style>` for `@media print` that hides everything except the marked receipt
3. Calls `window.print()`
4. Cleans up

### `src/index.css` — Add base print styles

Add `@media print` rules to hide navigation, sidebars, and non-essential UI.

## Files

| File | Action |
|------|--------|
| New migration SQL | Fix both RPC functions |
| `src/components/PaymentReceipt.tsx` | Scoped print logic |
| `src/index.css` | Add `@media print` base styles |

