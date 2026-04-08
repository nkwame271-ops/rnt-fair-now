

# Plan: Fix Serial Assignment & Unassign + Landlord Pair Display

## Three Issues

### Issue 1: "Claimed by another admin" during paired assignment
**Root cause**: `buildAndAssign()` calls `setSerialMap(newMap)` then `setTimeout(() => handleConfirmAssign(), 100)`. React state updates are async — `handleConfirmAssign` reads the old `serialMap` from state, which may be empty or partial. When the map is incomplete, the `processedSerials` logic fails because it uses stale card-to-serial mappings.

**Fix in `PendingPurchases.tsx`**:
- Refactor `handleConfirmAssign` to accept an optional `mapOverride` parameter
- In `buildAndAssign`, pass `newMap` directly: `handleConfirmAssign(newMap)` instead of using `setTimeout`
- Inside `handleConfirmAssign`, use `mapOverride ?? serialMap` to read the serial assignments
- Remove the fragile `setTimeout` pattern entirely

### Issue 2: Unassign serial — incomplete state reset
**Current behavior**: The edge function resets `serial_number` and `status` on the rent_cards row, but doesn't clear tenant/property/tenancy links or other fields.

**Fix in `admin-action/index.ts`** (`unassign_serial` case):
- When resetting `rent_cards` rows, also clear: `tenant_user_id`, `property_id`, `unit_id`, `tenancy_id`, `start_date`, `expiry_date`, `current_rent`, `previous_rent`, `advance_paid`, `last_payment_status`, `activated_at`, `qr_token`
- This ensures the card returns to a fully clean "awaiting_serial" state

### Issue 3: Landlord portal — show cards in pairs
**Current behavior**: Cards are listed individually with no visual pairing.

**Fix in `ManageRentCards.tsx`**:
- Group `filteredCards` by `serial_number` (cards sharing the same serial are a pair)
- For each pair, render a single card container showing both the Landlord Copy and Tenant Copy side by side (or stacked)
- Show the shared serial number once at the pair level, with each card's role badge (Landlord Copy / Tenant Copy)
- For "awaiting_serial" cards, group by `purchase_id` in pairs of 2

## Files to modify

| File | Change |
|------|--------|
| `src/pages/regulator/rent-cards/PendingPurchases.tsx` | Pass serial map directly to `handleConfirmAssign`, remove `setTimeout` |
| `supabase/functions/admin-action/index.ts` | Full field reset on unassign |
| `src/pages/landlord/ManageRentCards.tsx` | Group cards into pairs for display |

