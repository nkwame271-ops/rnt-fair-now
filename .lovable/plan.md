

# Plan: Complaint Status Fix + Hide Registration Fee When Disabled

## Issue 1: Complaint stays "Awaiting Payment" after payment

**Root cause:** In `MyCases.tsx`, after returning from Paystack, `verify-payment` is called and then `fetchComplaints()` runs. However, the webhook may not have processed yet, and the `verify-payment` edge function updates the complaint status (line 130-133) only when `status = "pending_payment"`. The issue is a race condition — `fetchComplaints()` fires before the update propagates, or the verify-payment response doesn't trigger a re-fetch.

**Fix in `src/pages/tenant/MyCases.tsx`:**
- After `verify-payment` returns `verified: true`, add a short delay before fetching complaints to let the status update propagate
- Also re-fetch after a second delay as a safety net

## Issue 2: Hide "Annual Registration" fee card on signup pages when fee is off

**Files:** `src/pages/RegisterTenant.tsx` (lines 199-213) and `src/pages/RegisterLandlord.tsx` (lines 193-207)

**Fix:** Wrap the fee card `<div>` in `{regFeeEnabled && (...)}` so it's hidden when the registration fee is turned off in Engine Room. Both pages already have `regFeeEnabled` from `useFeeConfig`.

## Summary of changes

| File | Change |
|---|---|
| `src/pages/tenant/MyCases.tsx` | Add delay after verify-payment before fetching complaints; fetch again after 2s as safety net |
| `src/pages/RegisterTenant.tsx` | Wrap "Annual Registration" fee card in `{regFeeEnabled && ...}` |
| `src/pages/RegisterLandlord.tsx` | Same wrapping |

