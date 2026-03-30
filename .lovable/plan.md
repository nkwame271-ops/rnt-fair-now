

# Plan: Fix Rejection Constraint, Dashboard Card Visibility, Payments Post-Tax

## Root Cause Analysis

The `tenancies` table has a CHECK constraint that only allows these status values:
```
'pending', 'active', 'completed', 'terminated', 'disputed'
```

The value `'rejected'` is **not permitted** by this constraint. That is why rejecting an agreement fails with the error. Similarly, statuses like `'renewal_window'`, `'existing_declared'`, `'awaiting_verification'`, `'verified_existing'` used elsewhere in the app are also not in this constraint — queries filtering on them would return no results.

## Changes

### 1. Database Migration — Expand status check constraint

Drop the existing `tenancies_status_check` and re-create it with all statuses the application uses:

```sql
ALTER TABLE public.tenancies DROP CONSTRAINT tenancies_status_check;
ALTER TABLE public.tenancies ADD CONSTRAINT tenancies_status_check
  CHECK (status = ANY (ARRAY[
    'pending', 'active', 'completed', 'terminated', 'disputed',
    'rejected', 'renewal_window', 'existing_declared',
    'awaiting_verification', 'verified_existing', 'expired'
  ]));
```

This immediately fixes the rejection cascade — the trigger function `handle_tenancy_rejection()` already exists and will fire correctly once the status value is allowed.

### 2. Dashboard — Only show tenancy cards after tenant has signed

Currently the query fetches all tenancies with `status IN (active, pending, ...)`. The user wants cards to appear only after the tenant has signed (i.e., tax is paid and agreement is signed).

**Fix**: Add `.not("tenant_signed_at", "is", null)` to the tenancy query in `TenantDashboard.tsx`. This ensures only signed agreements produce tenancy cards.

### 3. Payments — Post-tax flow (already implemented)

The code at lines 296-323 of `Payments.tsx` already shows "Advance Tax Paid ✓" with "Remaining Balance to Landlord" and two buttons (pay on platform / off-platform) when all advance tax is paid. No changes needed.

### 4. Office Fund Requests (already implemented)

`OfficeFundRequests.tsx` already has the submit form for sub-admins and review/approval UI for main admins. No changes needed.

## Files to Change

| File | Change |
|---|---|
| New migration | Drop and re-create `tenancies_status_check` with all valid statuses |
| `src/pages/tenant/TenantDashboard.tsx` | Add `tenant_signed_at IS NOT NULL` filter to tenancy query |

