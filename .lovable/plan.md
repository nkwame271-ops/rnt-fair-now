

# Plan: Account Deletion & Amount Formatting

## Part 1 — Account Deletion & Admin Management

### 1.1 Add `delete_account` action to Edge Function
**`supabase/functions/admin-action/index.ts`** — Add a `delete_account` case that:
- Validates admin is `main_admin`
- Checks for active tenancies before deleting
- Deletes the user's row from `landlords`/`tenants`/`admin_staff` table
- Deletes associated profile data
- Disables the auth user via service role (`auth.admin.updateUserById` with `ban_duration: '876000h'`)
- Logs to `admin_audit_log`

For admin account deletion: also remove from `admin_staff` and `user_roles`.

### 1.2 Add Delete buttons to AdminActions
**`src/pages/regulator/rent-cards/AdminActions.tsx`**:
- Add a "Delete" button alongside Deactivate/Archive for landlord/tenant accounts
- Add an "Admin" option to the account type selector (landlord, tenant, admin)
- When "admin" is selected, search `admin_staff` + `profiles` instead
- All delete buttons require `AdminPasswordConfirm`
- Only visible to Main Admin (already gated since AdminActions is in the Main Admin-only tab)

### 1.3 Engine Room: Show all admins (Main + Sub)
**`src/pages/regulator/EngineRoom.tsx`**:
- Change the staff query from `.eq("admin_type", "sub_admin")` to fetch ALL admin_staff records
- Display admin_type badge (Main Admin / Sub Admin) per staff member
- Allow feature-level muting/unmuting for both Main and Sub admins
- Add "Add Feature" / "Remove Feature" controls to dynamically modify `allowed_features` per admin

---

## Part 2 — Amount Formatting in Documents

### 2.1 Create a shared `formatGHS` utility
**`src/lib/formatters.ts`** — Add:
```typescript
export const formatGHS = (amount: number): string => {
  return `GHS ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};
// For cases needing decimals:
export const formatGHSDecimal = (amount: number): string => {
  return `GHS ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
```

### 2.2 Update all PDF generators
- **`src/lib/generateAgreementPdf.ts`** — Replace all `` GH₵ ${x.toLocaleString()} `` with `formatGHS(x)` (6 occurrences)
- **`src/lib/generateTenancyCardPdf.ts`** — Replace `GH₵` with `formatGHS()` (2 occurrences)
- **`src/lib/generateProfilePdf.ts`** — Replace `GH₵` with `formatGHS()` (3 occurrences)

### 2.3 Update UI components
- **`src/components/PaymentReceipt.tsx`** — Use `formatGHSDecimal()` (3 occurrences)
- **`src/components/TenancyCard.tsx`** — Use `formatGHS()` (2 occurrences)
- **`src/components/ProtectedRoute.tsx`** — Use `formatGHS()` (2 occurrences)

### 2.4 SMS service
- **`src/lib/smsService.ts`** — Replace `GH₵` with `GHS` in payment_confirmed template

---

## Files to Change

| File | Change |
|---|---|
| `supabase/functions/admin-action/index.ts` | Add `delete_account` action |
| `src/pages/regulator/rent-cards/AdminActions.tsx` | Add delete buttons, admin account search |
| `src/pages/regulator/EngineRoom.tsx` | Show all admins, dynamic feature add/remove |
| `src/lib/formatters.ts` | Add `formatGHS` and `formatGHSDecimal` helpers |
| `src/lib/generateAgreementPdf.ts` | Use `formatGHS` |
| `src/lib/generateTenancyCardPdf.ts` | Use `formatGHS` |
| `src/lib/generateProfilePdf.ts` | Use `formatGHS` |
| `src/components/PaymentReceipt.tsx` | Use `formatGHSDecimal` |
| `src/components/TenancyCard.tsx` | Use `formatGHS` |
| `src/components/ProtectedRoute.tsx` | Use `formatGHS` |
| `src/lib/smsService.ts` | Replace `GH₵` with `GHS` |

