

# Plan: Admin Fund Requests, Multi-Tenancy Dashboard, Renewal Selector, Payments Post-Tax, Rejection Cascade Fix

## 1. Office Fund Requests — Staff Submit Access

**Current state**: `OfficeFundRequests.tsx` already has the submit form for sub-admins (`!isMainAdmin && officeId` condition on line 167) and review UI for main admins. The page is already routed and in nav.

**Problem**: The user says "there should be a place where staff submit requests" — this already exists but may not be visible because the sub-admin's `allowed_features` doesn't include `office_wallet`. The `FEATURE_ROUTE_MAP` was updated in the last iteration.

**Fix**: No code changes needed — the feature is already built. If sub-admins can't see it, the main admin needs to add `office_wallet` to their `allowed_features` via Invite Staff. This is already supported.

**No changes required.**

## 2. Tenant Dashboard — Show ALL Tenancy Cards

**Problem**: The query on line 38 uses `.limit(1)`, so only the most recent tenancy card shows. Old ones are dismissed.

**Fix**: Remove `.limit(1)`, change state from single `tenancyCardData` to an array `tenancyCards: TenancyCardData[]`, and render all of them in the dashboard.

**File**: `src/pages/tenant/TenantDashboard.tsx`

## 3. Renewal — Show All Active Tenancies for Selection

**Problem**: `RequestRenewal.tsx` fetches only 1 tenancy (`.limit(1)` on line 43). Tenants with multiple active tenancies can't choose which one to renew.

**Fix**: Remove `.limit(1)`, fetch all eligible tenancies, show a selector if multiple exist, and let the tenant pick which one to renew.

**File**: `src/pages/tenant/RequestRenewal.tsx`

## 4. Payments — Post-Tax Flow Already Implemented

**Current state**: Lines 296-323 already show "Advance Tax Paid ✓" with "Remaining Balance to Landlord" and two buttons: "Pay Landlord on Platform (Coming Soon)" and "I Paid My Landlord Off-Platform". This matches the requirement.

**No changes required.**

## 5. Rejection Cascade — Debug Trigger

**Problem**: The migration created both the function and trigger, and the function is visible in `db-functions`. However, `db-triggers` says "no triggers." The trigger may have failed to apply.

**Root cause**: The `handleReject` code on line 127 uses `.update(...)` but doesn't check the response for errors — if the update itself fails (e.g., RLS blocks it), the cascade never fires.

**Fix**:
- Add proper error checking to `handleReject` — capture the `{ error }` from the update and show it
- Re-apply the trigger via a new migration (the previous one may have failed silently)
- Also add `tenant_accepted: false` to the update is already there, but the `as any` cast may mask type issues

**Files**: `src/pages/tenant/MyAgreements.tsx` (add error handling), new migration (re-create trigger with `DROP TRIGGER IF EXISTS` first)

## Files to Change

| File | Change |
|---|---|
| `src/pages/tenant/TenantDashboard.tsx` | Remove `.limit(1)`, show all tenancy cards as an array |
| `src/pages/tenant/RequestRenewal.tsx` | Remove `.limit(1)`, add tenancy selector dropdown for multiple active tenancies |
| `src/pages/tenant/MyAgreements.tsx` | Add error checking to `handleReject` update call |
| New migration | Re-create `on_tenancy_rejected` trigger with `DROP TRIGGER IF EXISTS` safety |

