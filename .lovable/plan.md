

# Plan: Fix Rejection Cascade Trigger + Verify Existing Implementations

## Problem Analysis

1. **Rejection cascade trigger missing**: The `on_tenancy_rejected` trigger does NOT exist in the database (confirmed via `pg_trigger` query). The function `handle_tenancy_rejection()` exists, but the trigger was never created despite the migration. The migration likely failed silently.

2. **Dashboard, Payments, Renewal**: These were all fixed in the previous iteration. The code already:
   - Shows all tenancy cards (no `.limit(1)`)
   - Shows post-tax "Remaining Balance" UI with two options
   - Allows selecting from multiple tenancies for renewal
   
   If the user is still seeing issues, it may be because the previous build hasn't fully deployed, or there's a data issue (e.g., only one tenancy exists for the test user).

3. **Office Fund Requests**: Already built in `OfficeFundRequests.tsx` with sub-admin submit form and main admin review UI.

## Changes Required

### 1. Re-create the rejection trigger via new migration

The previous migration's `CREATE TRIGGER` statement failed. We'll use a new migration with explicit schema qualification and verify it works.

```sql
DROP TRIGGER IF EXISTS on_tenancy_rejected ON public.tenancies;

CREATE TRIGGER on_tenancy_rejected
  AFTER UPDATE OF status ON public.tenancies
  FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected')
  EXECUTE FUNCTION public.handle_tenancy_rejection();
```

Key differences from previous attempt:
- Schema-qualify table and function as `public.tenancies` / `public.handle_tenancy_rejection()`
- Use `AFTER UPDATE OF status` to only fire on status column changes
- Add `WHEN` clause directly on the trigger (more efficient than checking inside the function)

### 2. Verify landlord Agreements page filters correctly

The landlord `Agreements.tsx` already filters: `activeTenancies = tenancies.filter(t => t.status !== "rejected")` — so rejected agreements are removed from the active list. No change needed once the trigger works.

## Files to Change

| File | Change |
|---|---|
| New migration | Create `on_tenancy_rejected` trigger with schema-qualified names |

No frontend changes needed — all UI corrections from the previous iteration are already in place.

