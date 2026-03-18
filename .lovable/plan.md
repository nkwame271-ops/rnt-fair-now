

# Fix Landlord Portal Payment Issues (5 bugs)

## Problem Summary

1. **Listing payment succeeds but property stays unlisted** — Frontend shows success toast on return from Paystack, but the webhook hasn't updated `listed_on_marketplace` yet. No client-side verification.
2. **Listing fee disabled = "No checkout URL received"** — `handleToggleListing` doesn't handle `{ skipped: true }` response from checkout.
3. **Add Tenant fee at the start** — User wants payment at the end of the process (after review), not as a gate before step 1.
4. **Rent cards don't appear after purchase** — Same timing issue: user returns from Paystack before webhook creates the cards. No verification/polling.
5. **Rent card receipts missing** — `verify-payment` only handles registration types, not rent cards. So no receipt is created via the fallback path, and the webhook may not have fired yet.

## Plan

### 1. Fix Listing: handle `skipped` + verify on return
**File: `src/pages/landlord/MyProperties.tsx`**

- In `handleToggleListing`: after the checkout call, check `data?.skipped` — if true, directly update the property to `listed_on_marketplace: true` and update local state.
- On page load with `trxref`/`reference` params: call `verify-payment` edge function with the reference, then poll the property's `listed_on_marketplace` status before showing success.

**File: `supabase/functions/verify-payment/index.ts`**

- Extend to handle `listing_fee` payment type: update `properties.listed_on_marketplace = true` for the related property.
- Also handle `rent_card_bulk` / `rent_card` payment types: create the rent cards (same logic as webhook).
- This ensures the verify-payment fallback path fully finalizes these payment types.

### 2. Move Add Tenant fee to end of process
**File: `src/pages/landlord/AddTenant.tsx`**

- Remove the fee gate from the beginning of the flow.
- Move the payment step to after the "Review" step — when the user clicks "Submit", check if fee is required. If so, redirect to Paystack. On return with `status=fee_paid`, auto-submit the tenancy.
- Store form data in state so it persists across the redirect, or use `sessionStorage`.

### 3. Fix Rent Cards not showing after purchase
**File: `src/pages/landlord/ManageRentCards.tsx`**

- On page load with `trxref`/`reference` params: call `verify-payment` to trigger card creation, then poll/refetch cards.
- The `verify-payment` function (updated in step 1) will handle creating rent cards if the webhook hasn't fired yet.

### 4. Fix Rent Card receipts
This is resolved by extending `verify-payment` (step 1) — it already creates receipts generically, but needs to also create the rent cards so the escrow is properly completed. Once verify-payment handles `rent_card_bulk`, receipts will be created.

## Files to modify

- `src/pages/landlord/MyProperties.tsx` — handle `skipped`, verify payment on return
- `src/pages/landlord/ManageRentCards.tsx` — verify payment on return, poll for cards
- `src/pages/landlord/AddTenant.tsx` — move fee to end of flow
- `supabase/functions/verify-payment/index.ts` — handle listing_fee + rent_card payment types

