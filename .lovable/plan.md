

# Fix Plan: Paired Serial Generation & Assignment

## Problem

The user reports issues with how paired mode works in serial generation and assignment:

1. **Generation** — Currently works correctly: in paired mode, each serial number gets 2 rows (pair_index 1 and 2). No change needed here.

2. **Assignment** — The bug: when assigning a serial, only the `pair_index=1` row is updated to "assigned". The `pair_index=2` row for the same serial_number stays "available", creating orphaned stock and incorrect counts.

## Root Cause

In `PendingPurchases.tsx` (line 437-447), the assignment update targets a single row by `id` (the pair_index=1 record). The pair_index=2 duplicate is never marked as assigned.

## Fix

### File: `src/pages/regulator/rent-cards/PendingPurchases.tsx`

**Change the assignment logic** (around line 437-453): After updating the pair_index=1 row by `id`, also update the matching pair_index=2 row by `serial_number` + `pair_index=2`:

```
// After updating pair_index=1 row:
await supabase
  .from("rent_card_serial_stock")
  .update({
    status: "assigned",
    assigned_to_card_id: card.id,
    assigned_at: new Date().toISOString(),
    assigned_by: user?.id,
  })
  .eq("serial_number", chosenSerial)
  .eq("pair_index", 2)
  .eq("status", "available");
```

This ensures both copies of a paired serial are marked as assigned together — 1 serial = 1 pair = 2 physical cards.

**No changes needed to:**
- Serial generation (`admin-action/index.ts`) — already creates pairs correctly
- Office allocation transfer — already handles both pair indices
- The UI display logic — already filters by pair_index=1 for display

### Summary

| File | Change |
|------|--------|
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | After assigning pair_index=1 row, also update the pair_index=2 row for the same serial_number to "assigned" |

