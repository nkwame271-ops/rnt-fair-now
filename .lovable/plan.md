

# Fix: Engine Room Super Admin Access, Escrow Office Attribution, Rent Increase Confirmation

## Issues

### 1. Engine Room Empty for Super Admin
The `RegulatorLayout` nav filter (line 75-88) treats the super_admin like a sub_admin because `profile.allowedFeatures.length > 0`. It runs the sub_admin filtering logic for super_admin users. While the Engine Room IS in the allowed list (so it should still show), there may be edge cases with the `isMainAdmin` check. The fix is to explicitly skip the sub-admin filter for super_admin users, matching the same pattern as the `superAdminOnly` check.

### 2. Escrow Office Attribution (Adenta shows 0, HQ shows all)
Root cause confirmed in the database: `finalize-office-attribution` correctly updates `escrow_splits.office_id` to the assigned office (e.g., `adenta`), but does NOT update `escrow_transactions.office_id` or `payment_receipts.office_id`. The Escrow Dashboard filters transactions and receipts by `escrow_transactions.office_id`, which remains `accra_central` (the default from `resolveOffice`). This means all deferred-type revenue appears under HQ.

**Fix**: Update `finalize-office-attribution` edge function to also update:
- `escrow_transactions.office_id` → the assigned office
- `payment_receipts.office_id` → the assigned office (matching by `escrow_transaction_id`)

### 3. Rent Increase Flow
This was already fixed in the previous round:
- Rent field is read-only with lock icon and hint text
- `monthly_rent` excluded from save payload
- Approval updates `asking_rent` for marketplace sync
- No further changes needed

## Files to Modify

1. **`src/components/RegulatorLayout.tsx`** (line 75-88)
   - Add early return for `profile?.isSuperAdmin` — show all nav items (same as main admin)

2. **`supabase/functions/finalize-office-attribution/index.ts`**
   - After updating splits, also update `escrow_transactions.office_id` to the attributed office
   - Also update `payment_receipts.office_id` for the matching `escrow_transaction_id`

3. **Database fix** — Update existing misattributed records:
   - For each `escrow_splits` row where `office_id` differs from the parent `escrow_transactions.office_id`, update the transaction and receipt to match

## Technical Details

**RegulatorLayout fix**:
```typescript
const navItems = allNavItems.filter(item => {
  if ((item as any).superAdminOnly && !profile?.isSuperAdmin) return false;
  // Super admin sees everything
  if (profile?.isSuperAdmin) return true;
  // Main admin or no profile — show all
  if (!profile || profile.isMainAdmin) return true;
  if (profile.allowedFeatures.length === 0) return true;
  // Sub admin filter
  const featureKey = getFeatureKeyForRoute(item.to);
  if (!featureKey) return true;
  return profile.allowedFeatures.includes(featureKey) && !profile.mutedFeatures.includes(featureKey);
});
```

**finalize-office-attribution fix** — after updating splits:
```typescript
// Also update the parent escrow_transaction office_id
await adminClient
  .from("escrow_transactions")
  .update({ office_id })
  .eq("id", escrow_transaction_id);

// Update receipt office_id
await adminClient
  .from("payment_receipts")
  .update({ office_id })
  .eq("escrow_transaction_id", escrow_transaction_id);
```

**Data correction** — fix existing misattributed records via migration:
```sql
UPDATE escrow_transactions et
SET office_id = (
  SELECT es.office_id FROM escrow_splits es
  WHERE es.escrow_transaction_id = et.id
    AND es.recipient = 'admin'
    AND es.office_id IS NOT NULL
    AND es.office_id != et.office_id
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM escrow_splits es
  WHERE es.escrow_transaction_id = et.id
    AND es.recipient = 'admin'
    AND es.office_id IS NOT NULL
    AND es.office_id != et.office_id
);
-- Same pattern for payment_receipts
```

