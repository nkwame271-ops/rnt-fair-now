

# Fix: Free Email/Phone on Account Deletion

## Problem

When an account is deleted (tenant, landlord, or admin), the code **bans** the auth user for 876,000 hours instead of actually deleting them:

```typescript
await adminClient.auth.admin.updateUserById(target_id, { ban_duration: "876000h" });
```

The auth record stays in `auth.users`, so the email/phone remains occupied and cannot be used to create a new account.

## Solution

Replace the ban with `adminClient.auth.admin.deleteUser(target_id)` in all three deletion paths (admin, landlord, tenant) inside `supabase/functions/admin-action/index.ts`.

This fully removes the auth record, freeing the email/phone for re-registration.

### Changes

**File**: `supabase/functions/admin-action/index.ts`

Three locations to update (lines 322, 358, and the corresponding `newState` lines):

```typescript
// BEFORE (3 occurrences):
await adminClient.auth.admin.updateUserById(target_id, { ban_duration: "876000h" });
newState = { status: "deleted", ban_duration: "876000h" };

// AFTER:
await adminClient.auth.admin.deleteUser(target_id);
newState = { status: "deleted" };
```

No other files need changes. The edge function will be redeployed after editing.

