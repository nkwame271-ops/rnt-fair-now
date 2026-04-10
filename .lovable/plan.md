

# Fix Super Admin to Have All Admin Capabilities

## Problem
The `super_admin` role is currently locked out of most admin features because:
1. The database function `is_main_admin()` only checks for `admin_type = 'main_admin'` — it does not include `super_admin`, so RLS policies block super admins from inserting/updating admin_staff, managing fund requests, reconciliation snapshots, etc.
2. Four edge functions explicitly check `admin_type !== "main_admin"` and reject super admins:
   - `invite-staff` — can't invite staff
   - `admin-action` — can't perform admin actions (deactivate accounts, delete staff, etc.)
   - `process-office-payout` — can't process payouts
   - `finalize-office-attribution` — can't finalize office attribution
3. Notification queries in `paystack-webhook` only notify `main_admin` users, missing super admins

## Changes

### 1. Database migration — Update `is_main_admin()` function
Update the function to include `super_admin`:
```sql
CREATE OR REPLACE FUNCTION public.is_main_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_staff
    WHERE user_id = _user_id
    AND admin_type IN ('main_admin', 'super_admin')
  )
$$;
```
This single change fixes ALL RLS policies that use `is_main_admin()` — admin_staff insert/update, fund requests, reconciliation snapshots, etc.

### 2. Edge function fixes — 4 functions
Update the admin_type check in each function to accept both `main_admin` and `super_admin`:

- **`invite-staff/index.ts`** — line 65: change `!== "main_admin"` to `!== "main_admin" && admin_type !== "super_admin"`
- **`admin-action/index.ts`** — line 98: same pattern
- **`process-office-payout/index.ts`** — line 44: same pattern
- **`finalize-office-attribution/index.ts`** — similar check
- **`paystack-webhook/index.ts`** — notification queries: add `OR admin_type = 'super_admin'` filter so super admins also receive critical payment alerts

### 3. Promote user account
Run a migration to set the main RCD administrator account to `super_admin` type so you can access and test everything.

## Result
Super Admin will have every capability that Main Admin has, plus the exclusive Super Admin Dashboard controls (visibility, renaming, activity logs, ledger).

