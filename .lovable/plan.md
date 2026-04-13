

# Fix: Engine Room Super Admin, Escrow Revenue Accuracy & Fee Component Splitting

## Issues

### 1. Engine Room Empty for Super Admin
The `isMainAdmin` fallback at line 510 (`profile?.isMainAdmin ?? (role === "regulator" && !profileLoading)`) should work, but `profileLoading` may remain `true` if the admin_staff query finds no record. The `useAdminProfile` hook sets `loading` to `false` when `data` is null (line 46-48 of useAdminProfile), so the fallback should trigger. Need to verify the hook returns `loading: false` when no record exists and ensure the Engine Room loading guard at line 650 waits for both `loading` (feature flags) AND `profileLoading` to finish.

**Fix**: The loading guard at line 650 uses `loading || profileLoading`. If `profileLoading` never resolves for users without an `admin_staff` row, the page stays on the loader. Add a timeout fallback and ensure `useAdminProfile` correctly sets `loading: false` when query returns null. Also add a `isSuperAdmin` check directly from the `role` context so Super Admins without admin_staff records still see content.

### 2. Escrow Revenue — Bundle Payments Not Showing
The `REVENUE_TYPE_CONFIG` at line 44-54 maps specific `payment_type` values to revenue categories. `existing_tenancy_bundle` is NOT mapped to any category, so its revenue (GHS 3 in current data) is invisible in the "Revenue by Type" cards and excluded from "Total Revenue".

**Fix**: 
- Add `existing_tenancy_bundle` to the "Tenancy Agreement" types array (short-term fix for display)
- Add new revenue categories for individual fee components: "Tenant Registration Fee", "Tenancy Filing Fee"

### 3. Split Bundle Payments Into Individual Fee Components (Critical)
Currently, `existing_tenancy_bundle` creates ONE `escrow_transaction` record with `payment_type: "existing_tenancy_bundle"`. For accurate reporting, each fee component should be its OWN `escrow_transaction` record.

**Fix in `finalize-payment.ts`**: When a completed `existing_tenancy_bundle` payment is finalized, instead of creating one set of splits under the bundle transaction, create separate child `escrow_transaction` records for each fee component (`register_tenant_fee`, `filing_fee`, `agreement_sale`) with their individual amounts. The parent bundle transaction is marked completed but its `total_amount` is set to 0 for reporting (or excluded). Each child transaction gets its own splits.

**Alternative (simpler, recommended)**: Keep the single escrow_transaction but update `REVENUE_TYPE_CONFIG` to map bundle types and include individual fee descriptions in splits. For the Escrow Dashboard, parse the split descriptions to attribute revenue to individual fee types rather than the parent payment_type.

**Chosen approach**: Modify the `finalize-payment.ts` to create individual `escrow_transactions` per fee component when finalizing a bundle. The parent bundle record stays as `completed` but child transactions are created with individual `payment_type` values. The Dashboard then naturally picks them up.

### 4. Add Tenant Fee — Same Treatment
The `add_tenant_fee` is currently a single payment type. The user wants it split into individual components too (Register Tenant Fee, Agreement Fee, Filing Fee). Currently `add_tenant_fee` uses `determineFee` with a single band — it doesn't have the component breakdown that `existing_tenancy_bundle` has.

**Fix**: Update the `add_tenant_fee` checkout flow to use the same component-based approach as `existing_tenancy_bundle` — look up `add_tenant` band and split into individual fee components with separate payment_type values in the split plan metadata. On finalization, create child escrow_transactions.

### 5. Visibility Configuration for New Fee Types
New fee types (`register_tenant_fee`, `filing_fee`) need to be available in the Super Admin visibility config.

**Fix**: Add entries to `REVENUE_TYPE_CONFIG` with visibility keys so the Super Admin can mute/show them.

## Files to Modify

1. **`src/pages/regulator/EscrowDashboard.tsx`**
   - Update `REVENUE_TYPE_CONFIG` to add: "Tenant Registration Fee" (types: `register_tenant_fee`), "Tenancy Filing Fee" (types: `filing_fee`), and keep "Tenancy Agreement" for `agreement_sale`
   - Remove `add_tenant_fee` and `existing_tenancy_bundle` from "Tenancy Agreement" — they become parent types excluded from revenue
   - Total Revenue now correctly sums individual components

2. **`supabase/functions/_shared/finalize-payment.ts`**
   - After finalizing a bundle payment (`existing_tenancy_bundle`), create child `escrow_transaction` records for each fee component using the split_plan metadata
   - Each child gets `payment_type` = the component type, `total_amount` = that component's fee, and its own splits
   - Mark parent as `is_bundle: true` in metadata so dashboard can exclude it from revenue sums

3. **`supabase/functions/paystack-checkout/index.ts`**
   - Update `add_tenant_fee` flow to use component-based approach with `add_tenant` bands (register_fee, filing_fee, agreement_fee columns)
   - Store component breakdown in metadata.fee_components for finalize-payment to use

4. **`src/pages/regulator/EngineRoom.tsx`**
   - Harden Super Admin fallback: if `profile` is null AND `role === "regulator"`, treat as main admin after both loading states resolve
   - Add explicit `role` dependency to loading guard

5. **`src/hooks/useAdminProfile.ts`**
   - Verify and ensure `loading` is set to `false` even when no admin_staff record exists

## Technical Details

**Revenue Type Config update**:
```typescript
const REVENUE_TYPE_CONFIG = [
  // ...existing entries...
  { label: "Tenant Registration Fee", types: ["register_tenant_fee"], color: "...", visibilityKey: "revenue_type_register_tenant" },
  { label: "Tenancy Filing Fee", types: ["filing_fee"], color: "...", visibilityKey: "revenue_type_filing" },
  // "Tenancy Agreement" keeps only ["agreement_sale"]
  // Remove "add_tenant_fee" from here — it becomes a bundle parent
];
```

**Finalize-payment child creation**:
```typescript
// After finalizing bundle, create child transactions
if (paymentType === "existing_tenancy_bundle" || paymentType === "add_tenant_fee") {
  const feeComponents = meta.fee_components || meta.split_plan_components;
  if (feeComponents) {
    for (const component of feeComponents) {
      // Insert child escrow_transaction with component.type as payment_type
      // Insert child escrow_splits from the component's allocations
    }
  }
}
```

**Engine Room Super Admin fix**:
```typescript
const isMainAdmin = profile?.isMainAdmin ?? (role === "regulator");
// Remove profileLoading dependency — if role is regulator, they're admin
```
