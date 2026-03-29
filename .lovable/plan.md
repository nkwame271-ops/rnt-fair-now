

# Fix: Payment Not Processing After Successful Checkout

## Root Cause (confirmed via database inspection)

All 11 `rent_tax_bulk` escrow transactions are stuck at `pending` — zero have ever completed. The Paystack webhook has no recent logs, suggesting webhooks either aren't reaching the function or aren't configured in Paystack for this environment.

The backup mechanism (`verify-payment` edge function) also has **zero logs**, meaning it's never being called successfully. The client-side code in `Payments.tsx` calls `verify-payment` inside a `useEffect` that runs immediately on mount — **before the Supabase auth session has been restored from localStorage** after the Paystack redirect. The call fails with a 401 auth error, which is silently swallowed by `.catch(() => {})`. The page then reloads, perpetuating the cycle.

## Fixes

### 1. Fix `Payments.tsx` — wait for auth before verifying payment

The success-redirect `useEffect` (line 77) runs on mount without waiting for the authenticated user. It must:
- Depend on `user` being available before calling `verify-payment`
- Not swallow errors silently — log them and show user feedback
- Not auto-reload until verification completes or definitively fails
- After successful verification, reload the page to reflect updated payment state

### 2. Fix `MyAgreements.tsx` — same auth timing issue

The auto-verification effect (line 271) properly waits for `loading` to be false, but the `verifyPayment` function's call to `supabase.functions.invoke("verify-payment")` may still fail if the auth token isn't ready. Add explicit error logging and retry.

### 3. Landlord Agreements — already fixed

Rejected tenancies are already filtered out of the active list (line 144) and shown in a collapsible section. No changes needed.

### 4. Archive Search Fee — already working

The `archive_search_fee` flag exists in `feature_flags` with `category = 'fees'`, `fee_amount = 20`, `is_enabled = true`. Engine Room dynamically renders all flags including this one.

## Files to Change

| File | Change |
|---|---|
| `src/pages/tenant/Payments.tsx` | Make verify-payment call wait for authenticated user; add error logging; prevent reload until verified |
| `src/pages/tenant/MyAgreements.tsx` | Add error logging to verify-payment calls; improve retry resilience |

