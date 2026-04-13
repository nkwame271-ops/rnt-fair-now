

# Fix: Invite Admin & Create Staff Errors

## Root Causes

### 1. "fullName, email, and password required" (Super Admin → Create New Staff)
The `handleCreateStaff` in `SuperAdminDashboard.tsx` sends body keys using **snake_case** (`full_name`, `phone`), but the edge function `invite-staff/index.ts` destructures **camelCase** (`fullName`). The value arrives as `undefined`, triggering the validation error.

### 2. "Database error creating new user" (Invite Admin page)
The auth logs show: `duplicate key value violates unique constraint "idx_profiles_email_unique"`. When `createUser` runs, the `handle_new_user` trigger inserts into `profiles`, but if a profile row with that email already exists (from a previous failed attempt or a different user), it causes a constraint violation that aborts the entire transaction.

The `invite-staff` edge function checks `listUsers()` for existing auth users, but does NOT check the `profiles` table for orphaned email rows.

## Fixes

### File 1: `src/pages/regulator/SuperAdminDashboard.tsx`
- Change the `body` in `handleCreateStaff` to use camelCase keys matching what the edge function expects:
  - `full_name` → `fullName`
  - `admin_type` → `adminType`
  - `office_id` → `officeId`
  - `office_name` → `officeName`

### File 2: `supabase/functions/invite-staff/index.ts`
- Before calling `createUser`, check if a `profiles` row with that email already exists. If it does (orphaned from a previous failed attempt), delete the orphaned profile row first.
- This prevents the unique constraint violation in the `handle_new_user` trigger.

### File 3: `src/pages/regulator/InviteStaff.tsx`
- Verify this page also sends camelCase keys (it does — `fullName`, `adminType`, etc. — so no change needed here). The issue is only in `SuperAdminDashboard.tsx`.

## Technical Details

**SuperAdminDashboard fix** (line 464-474):
```typescript
const { data, error } = await supabase.functions.invoke("invite-staff", {
  body: {
    email: newStaff.email,
    fullName: newStaff.full_name,    // was: full_name
    password: newStaff.password,
    adminType: newStaff.admin_type,  // was: admin_type
    officeId: newStaff.office_id || null,   // was: office_id
    officeName: newStaff.office_name || null, // was: office_name
  },
});
```

**invite-staff orphan cleanup** (before createUser):
```typescript
// Clean up orphaned profile row if exists
const { data: orphanProfile } = await adminClient
  .from("profiles")
  .select("user_id")
  .eq("email", email.toLowerCase())
  .maybeSingle();

if (orphanProfile) {
  await adminClient.from("profiles").delete().eq("user_id", orphanProfile.user_id);
}
```

