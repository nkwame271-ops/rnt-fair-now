

# Fix: Admin Action Audit Log Not Saving + Password Re-auth Bug

## Problem Found
Both **Revoke Batch** and **Unassign Serial** execute successfully — I confirmed this by calling the edge function live:
- Revoked 497 serials from "Batch1" ✓
- Unassigned serial "26/0000498" ✓

However, the **audit log is always empty** (0 rows). The root cause:

The `admin-action` edge function creates an `adminClient` using `SUPABASE_SERVICE_ROLE_KEY`, then calls `adminClient.auth.signInWithPassword()` to verify the admin's password. This **mutates the client session** — after that call, `adminClient` operates as an authenticated user, not as service_role. The subsequent audit log insert silently fails because the `admin_audit_log` table only allows `service_role` to insert.

The revoke/unassign operations themselves succeed because regulators have UPDATE RLS policies on `rent_card_serial_stock`.

## Fix

In `supabase/functions/admin-action/index.ts`:

1. **Create a separate client for password verification** — use a throwaway client for the `signInWithPassword` call, keeping the `adminClient` (service_role) clean for all data operations.

```typescript
// Instead of:
const { error: reAuthError } = await adminClient.auth.signInWithPassword(...)

// Use:
const verifyClient = createClient(supabaseUrl, anonKey);
const { error: reAuthError } = await verifyClient.auth.signInWithPassword(...)
```

This is a one-line fix in the edge function. No UI changes needed — the AdminActions UI is already correct.

## Files to Modify
| File | Change |
|---|---|
| `supabase/functions/admin-action/index.ts` | Use separate client for password verification |

