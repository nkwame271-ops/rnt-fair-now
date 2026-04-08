

# Plan: Fix Serial Assignment, Unassign, and Landlord Pair Display

## Issue 1: "Claimed by another admin" — Root Cause Found

The **transfer/office stock** query (line 347-356 in `PendingPurchases.tsx`) does NOT filter by `pair_index = 1`, unlike the quota path (line 335). This means `availableSerials` contains **both** pair_index=1 and pair_index=2 rows for each serial — doubling the list. The `Math.floor(i/2)` pairing logic then maps cards to wrong serials, causing duplicate stock update attempts and the false "claimed" error.

**Fix**: Add `.eq("pair_index", 1)` to the office stock query (line 354), matching the quota path.

## Issue 2: Unassign — Partial Reset

The unassign logic finds rent cards via `assigned_to_card_id` on stock rows. But during assignment, both stock rows (pair_index 1 and 2) store the **same** card ID (the first card processed). The second card in the pair is never referenced by any stock row, so it's never reset during unassign.

**Fix**: Instead of relying on `assigned_to_card_id`, query `rent_cards` by `serial_number` to find ALL cards linked to that serial, then reset all of them.

## Issue 3: Landlord Pair Display

Already implemented in previous edit — verify it's working correctly after the above fixes.

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Add `.eq("pair_index", 1)` to office stock query (line 354) |
| `supabase/functions/admin-action/index.ts` | In `unassign_serial`: find cards by `serial_number` instead of `assigned_to_card_id` |

