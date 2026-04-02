

# Fix: Rent Band Fee Control — Platform Fees Must Not Override Amount

## Problem

In `determineFee()` (paystack-checkout lines 34-71), when a band-based payment type (`agreement_sale`, `add_tenant_fee`) either:
- has no `monthlyRent` provided, or
- no rent band matches the provided rent

...it **falls back to `flagData?.fee_amount`** from Platform Fees (feature_flags table). This means the Platform Fees amount field silently overrides the rent band fee, which is wrong.

For band-based types, Platform Fees should **only** control the on/off toggle. The amount must always come from rent bands.

## Changes

### 1. `supabase/functions/paystack-checkout/index.ts` — `determineFee` function

Current (broken):
```
// Falls back to feature_flags fee_amount for band-based types
const amount = flagData?.fee_amount ?? 0;
return { amount, enabled, rentBandId: null, paymentType };
```

Fix:
- For band-based types, if `monthlyRent` is not provided or no band matches, throw an error instead of falling back to the flat fee amount.
- The feature_flags row for `agreement_sale_fee` and `add_tenant_fee` will only be read for its `fee_enabled` field. Its `fee_amount` is ignored.

New logic:
```
if (BAND_BASED_TYPES.has(paymentType)) {
  if (monthlyRent == null || monthlyRent <= 0) {
    throw new Error("Monthly rent is required to determine the fee for this payment type.");
  }
  // monthlyRent was provided but no band matched
  throw new Error("No rent band configured for monthly rent of GH₵ " + monthlyRent);
}
// Only flat fee types reach here
const amount = flagData?.fee_amount ?? 0;
return { amount, enabled, rentBandId: null, paymentType };
```

### 2. Frontend pages that call checkout for band-based types

Verify that `AddTenant.tsx` and `DeclareExistingTenancy.tsx` always pass `monthlyRent` in the checkout request body. From the earlier audit, `AddTenant` was updated to pass it and `DeclareExistingTenancy` already passes it via the `agreement_sale` type. Confirm both paths, fix if missing.

### 3. Engine Room UI hint (optional but helpful)

In the Platform Fees section of `EngineRoom.tsx`, for `agreement_sale_fee` and `add_tenant_fee`, disable or hide the fee amount input and show a note: "Amount is determined by Rent Bands". This prevents regulator confusion.

## Files to change

| File | Change |
|------|--------|
| `supabase/functions/paystack-checkout/index.ts` | Update `determineFee` to throw instead of falling back to flat fee for band-based types |
| `src/pages/regulator/EngineRoom.tsx` | Hide/disable fee amount input for band-based fee keys; show "Set via Rent Bands" label |
| `src/pages/landlord/AddTenant.tsx` | Confirm `monthlyRent` is always passed (already done in prior update — verify) |

