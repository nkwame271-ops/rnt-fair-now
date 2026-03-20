

# Fix: Account Status Not Reflected in Databases + Re-registration Prevention

## Issues Found

### Issue 1: Regulator Databases show `status` instead of `account_status`
Both `RegulatorTenants.tsx` and `RegulatorLandlords.tsx` fetch and display the **`status`** column (which tracks registration status like active/expired), NOT the **`account_status`** column (which tracks deactivated/archived). So when admin deactivates an account, the database pages still show "active".

**Fix**: Fetch `account_status` alongside `status` and display it as a badge (e.g. red "Deactivated" tag) when not "active". Also add `account_status` to the status filter dropdown.

### Issue 2: Deactivated users can re-register with same phone number
The registration flow uses `supabase.auth.signUp()` with a synthetic email based on the phone number. If the auth record still exists, Supabase returns "already registered" and the user is told to log in. **However**, if the auth record was deleted or if the user uses a different phone format, they could bypass this. More critically, even without re-registration, the current system has no check that blocks a deactivated user from simply **logging in** and being blocked only at the `ProtectedRoute` level — which is correct behavior. But if auth records get cleaned up, they could re-register.

**Fix**: Add a pre-check in both `RegisterTenant.tsx` and `RegisterLandlord.tsx` that queries the `profiles` table by phone number, then checks if the linked tenant/landlord record has `account_status = 'deactivated'` or `'archived'`. If so, block registration with a clear message.

## Files Changed

| File | Change |
|---|---|
| `src/pages/regulator/RegulatorTenants.tsx` | Fetch + display `account_status`, add filter option |
| `src/pages/regulator/RegulatorLandlords.tsx` | Fetch + display `account_status`, add filter option |
| `src/pages/RegisterTenant.tsx` | Pre-check phone against deactivated accounts before signup |
| `src/pages/RegisterLandlord.tsx` | Pre-check phone against deactivated accounts before signup |

## Details

### RegulatorTenants.tsx / RegulatorLandlords.tsx
- Add `account_status` to the `.select()` query (line 68 / line 62)
- Add `account_status` to the interface
- Display a red "Deactivated" or "Archived" badge next to the existing status badge when `account_status !== 'active'`
- Add filter options: "Deactivated", "Archived" to the status dropdown
- Include `account_status` in CSV export

### RegisterTenant.tsx / RegisterLandlord.tsx
- Before `signUp`, query `profiles` by phone → get `user_id` → check `tenants`/`landlords` table for `account_status`
- If deactivated/archived, show error: "This phone number is linked to a deactivated account. Please contact Rent Control for assistance."
- Block registration

