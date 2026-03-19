

# Fix: Don't retroactively charge users who registered for free

## Problem
When a user registers while the registration fee is **disabled**, their record is created with `registration_fee_paid: false`. Later, when the fee is turned back on, `ProtectedRoute` sees `!feePaid && regFeeEnabled` and blocks them with a paywall — even though they legitimately registered for free.

## Root cause
Registration always sets `registration_fee_paid: false` regardless of whether the fee is enabled. The fee-waiver logic only runs later in `paystack-checkout` (when user clicks pay), not at signup time.

## Solution

### 1. Set `registration_fee_paid: true` at signup when fee is disabled
**Files:** `src/pages/RegisterTenant.tsx`, `src/pages/RegisterLandlord.tsx`

At the point where the tenant/landlord record is inserted (~line 158-161 in RegisterTenant, ~line 152-155 in RegisterLandlord), check if `regFeeEnabled` is false. If so, set `registration_fee_paid: true`, `registration_date: now`, and `expiry_date: now + 1 year` immediately.

### 2. Grandfather existing free users via ProtectedRoute
**File:** `src/components/ProtectedRoute.tsx`

In the paywall check (line 146), also fetch `registration_date` from the tenant/landlord record. If a user already has a `registration_date` set (meaning they completed registration during a free period), treat them as paid — skip the paywall. This handles users who already registered for free before this fix.

Update `checkRegistration` to return both `registration_fee_paid` and `registration_date`, then use the logic:
```
const shouldBlock = !feePaid && !hasRegistrationDate && regFeeEnabled;
```

### Files to modify
| File | Change |
|---|---|
| `src/pages/RegisterTenant.tsx` | Set `registration_fee_paid: true` + dates when fee disabled |
| `src/pages/RegisterLandlord.tsx` | Same |
| `src/components/ProtectedRoute.tsx` | Also check `registration_date` — if set, skip paywall |

